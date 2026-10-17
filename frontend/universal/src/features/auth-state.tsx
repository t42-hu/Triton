import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { backend, BackendError, clearChallenge, onSessionExpired } from '@/data/backend';
import { setSessionToken } from '@/data/session-token';
import { clearAccountMemory, selectAccountDatabase } from '@/data/database';
import { legacyProfileCount, finishLegacyChoice } from '@/data/legacy-workspace';
import { offlineAccount, rememberOfflineAccount, type OfflineAccount } from '@/data/offline-account';
import { restoreAccountSession } from '@/data/account-session';
import { isConnectionFailure } from '@/data/offline-account-model';
type User = OfflineAccount;
async function openAccount(user: User) { await selectAccountDatabase(user.id); await rememberOfflineAccount(user); }
async function sessionAfterChallenge(session: { user: User } | null, setPending: (value: boolean) => void) {
  if (session?.user) return session;
  try {
    const challenge = await backend<{ pending: boolean }>('/auth/two-factor/email/status', 'POST', {});
    if (challenge.pending) { setPending(true); return null; }
    return await backend<{ user: User } | null>('/auth/get-session');
  } catch (error) { if (!(error instanceof BackendError) || error.status !== 401) throw error; return null; }
}
type Auth = { twoFactorPending: boolean; verifySecondFactor: () => Promise<boolean>; cancelSecondFactor: () => Promise<void>; refreshUser: () => Promise<void>; clearAccount: () => Promise<void>; user: User | null; legacyCount: number; finishSetup: (include: boolean) => Promise<void>; checking: boolean; error: string; retry: () => void; authenticate: (email: string, password: string, register: boolean, captchaToken?: string) => Promise<void>; signOut: () => Promise<void> };
const Context = createContext<Auth | null>(null);
function useAuthSession(setTwoFactorPending: (value: boolean) => void) {
  const [user, setUser] = useState<User | null>(null);
  const [legacyCount, setLegacyCount] = useState(0);
  const [checking, setChecking] = useState(true);
  const [error, setError] = useState('');
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let cancelled = false;
    async function showCached() {
      const cached = await offlineAccount();
      if (!cached || cancelled) return;
      await selectAccountDatabase(cached.id);
      if (cancelled) return;
      setUser(cached); setChecking(false);
    }
    async function reportRestoreError(error: unknown) {
      if (cancelled) return;
      if (!isConnectionFailure(error)) { setUser(null); await rememberOfflineAccount(null); }
      setError(error instanceof Error ? error.message : String(error));
    }
    function setPending(value: boolean) { if (!cancelled) setTwoFactorPending(value); }
    async function restore() {
      try {
        await showCached();
        const session = await sessionAfterChallenge(await restoreAccountSession(), setPending);
        if (cancelled) return;
        if (session?.user) { await openAccount(session.user); const count = await legacyProfileCount(session.user.id); setLegacyCount(cancelled ? 0 : count); }
        else await rememberOfflineAccount(null);
        if (!cancelled) setUser(session?.user ?? null);
      } catch (error) { await reportRestoreError(error); }
      finally { if (!cancelled) setChecking(false); }
    }
    void restore();
    return () => { cancelled = true; };
  }, [attempt, setTwoFactorPending]);
  function expire() { void rememberOfflineAccount(null); setUser(null); setError('A munkamenet lejárt. Jelentkezz be újra.'); }
  useEffect(() => onSessionExpired(expire), []);
  return { user, setUser, legacyCount, setLegacyCount, checking, error, setError, setChecking, setAttempt };
}
export function AuthProvider({ children }: { children: ReactNode }) {
  const [twoFactorPending, setTwoFactorPending] = useState(false);
  const { user, setUser, legacyCount, setLegacyCount, checking, error, setError, setChecking, setAttempt } = useAuthSession(setTwoFactorPending);
  const challengeGeneration = useRef(0);
  async function authenticate(email: string, password: string, register: boolean, captchaToken?: string) {
    const normalized = email.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized)) throw new Error('Adj meg érvényes email-címet.');
    if (register && (password.length < 8 || password.length > 128)) throw new Error('A jelszó 8–128 karakter hosszú legyen.');
    if (!password) throw new Error('Add meg a jelszavad.');
    const result = await backend<{ user: User; twoFactorRedirect?: boolean }>(register ? '/auth/sign-up/email' : '/auth/sign-in/email', 'POST', { email: normalized, password, ...(register ? { name: normalized.split('@')[0] } : { rememberMe: true }) }, captchaToken ? { 'x-captcha-response': captchaToken } : {});
    if (result.twoFactorRedirect) { setTwoFactorPending(true); return; }
    await openAccount(result.user);
    setLegacyCount(await legacyProfileCount(result.user.id));
    setError(''); setUser(result.user);
  }
  async function finishSetup(include: boolean) { if (!user) return; await finishLegacyChoice(user.id, include); setLegacyCount(0); }
  async function refreshUser() { const session = await backend<{ user: User } | null>('/auth/get-session'); await rememberOfflineAccount(session?.user ?? null); setUser(session?.user ?? null); }
  async function cancelSecondFactor() {
    challengeGeneration.current += 1;
    await backend('/auth/two-factor/email/cancel', 'POST', {});
    await clearChallenge(); setTwoFactorPending(false);
  }
  async function verifySecondFactor() {
    const generation = challengeGeneration.current;
    const result = await backend<{ pending: boolean }>('/auth/two-factor/email/status', 'POST', {});
    if (result.pending || generation !== challengeGeneration.current) return false;
    const session = await backend<{ user: User }>('/auth/get-session');
    if (generation !== challengeGeneration.current) return false;
    await openAccount(session.user); setLegacyCount(await legacyProfileCount(session.user.id)); setUser(session.user); setTwoFactorPending(false); setError('');
    return true;
  }
  async function clearAccount() { setUser(null); await clearChallenge(); setTwoFactorPending(false); setLegacyCount(0); await setSessionToken(null); await rememberOfflineAccount(null); await clearAccountMemory(); }
  async function signOut() {
    await backend('/auth/sign-out', 'POST', {});
    await clearAccount();
  }
  function retry() { setChecking(true); setError(''); setAttempt(value => value + 1); }
  return <Context.Provider value={{ twoFactorPending, verifySecondFactor, cancelSecondFactor, refreshUser, clearAccount, user, legacyCount, finishSetup, checking, error, retry, authenticate, signOut }}>{children}</Context.Provider>;
}
export function useAuth() { const value = useContext(Context); if (!value) throw new Error('Hiányzó AuthProvider.'); return value; }
