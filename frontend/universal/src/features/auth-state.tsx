import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { backend, clearChallenge, onSessionExpired } from '@/data/backend';
import { setSessionToken } from '@/data/session-token';
import { clearAccountMemory, selectAccountDatabase } from '@/data/database';
import { legacyProfileCount, finishLegacyChoice } from '@/data/legacy-workspace';
type User = { id: string; email: string; name: string; image?: string | null; twoFactorEnabled?: boolean };
type Auth = { twoFactorPending: boolean; verifySecondFactor: (code: string, backup: boolean) => Promise<void>; cancelSecondFactor: () => void; refreshUser: () => Promise<void>; clearAccount: () => Promise<void>; user: User | null; legacyCount: number; finishSetup: (include: boolean) => Promise<void>; checking: boolean; error: string; retry: () => void; authenticate: (email: string, password: string, register: boolean, captchaToken?: string) => Promise<void>; signOut: () => Promise<void> };
const Context = createContext<Auth | null>(null);
function useAuthSession() {
  const [user, setUser] = useState<User | null>(null);
  const [legacyCount, setLegacyCount] = useState(0);
  const [checking, setChecking] = useState(true);
  const [error, setError] = useState('');
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let cancelled = false;
    async function restore() {
      try {
        const session = await backend<{ user: User } | null>('/auth/get-session');
        if (cancelled) return;
        if (session?.user) { await selectAccountDatabase(session.user.id); const count = await legacyProfileCount(session.user.id); setLegacyCount(cancelled ? 0 : count); }
        if (!cancelled) setUser(session?.user ?? null);
      } catch (error) { if (!cancelled) setError(error instanceof Error ? error.message : String(error)); }
      finally { if (!cancelled) setChecking(false); }
    }
    void restore();
    return () => { cancelled = true; };
  }, [attempt]);
  function expire() { setUser(null); setError('A munkamenet lejárt. Jelentkezz be újra.'); }
  useEffect(() => onSessionExpired(expire), []);
  return { user, setUser, legacyCount, setLegacyCount, checking, error, setError, setChecking, setAttempt };
}
export function AuthProvider({ children }: { children: ReactNode }) {
  const { user, setUser, legacyCount, setLegacyCount, checking, error, setError, setChecking, setAttempt } = useAuthSession();
  const [twoFactorPending, setTwoFactorPending] = useState(false);
  async function authenticate(email: string, password: string, register: boolean, captchaToken?: string) {
    const normalized = email.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized)) throw new Error('Adj meg érvényes email-címet.');
    if (register && (password.length < 8 || password.length > 128)) throw new Error('A jelszó 8–128 karakter hosszú legyen.');
    if (!password) throw new Error('Add meg a jelszavad.');
    const result = await backend<{ user: User; twoFactorRedirect?: boolean }>(register ? '/auth/sign-up/email' : '/auth/sign-in/email', 'POST', { email: normalized, password, ...(register ? { name: normalized.split('@')[0] } : { rememberMe: true }) }, captchaToken ? { 'x-captcha-response': captchaToken } : {});
    if (result.twoFactorRedirect) { setTwoFactorPending(true); return; }
    await selectAccountDatabase(result.user.id);
    setLegacyCount(await legacyProfileCount(result.user.id));
    setError(''); setUser(result.user);
  }
  async function finishSetup(include: boolean) { if (!user) return; await finishLegacyChoice(user.id, include); setLegacyCount(0); }
  async function refreshUser() { const session = await backend<{ user: User } | null>('/auth/get-session'); setUser(session?.user ?? null); }
  function cancelSecondFactor() { clearChallenge(); setTwoFactorPending(false); }
  async function verifySecondFactor(code: string, backup: boolean) {
    await backend(backup ? '/auth/two-factor/verify-backup-code' : '/auth/two-factor/verify-totp', 'POST', { code: code.trim() });
    const session = await backend<{ user: User }>('/auth/get-session');
    await selectAccountDatabase(session.user.id); setLegacyCount(await legacyProfileCount(session.user.id)); setUser(session.user); setTwoFactorPending(false); setError('');
  }
  async function clearAccount() { clearChallenge(); setTwoFactorPending(false); setLegacyCount(0); await setSessionToken(null); await clearAccountMemory(); setUser(null); }
  async function signOut() {
    await backend('/auth/sign-out', 'POST', {});
    await clearAccount();
  }
  function retry() { setChecking(true); setError(''); setAttempt(value => value + 1); }
  return <Context.Provider value={{ twoFactorPending, verifySecondFactor, cancelSecondFactor, refreshUser, clearAccount, user, legacyCount, finishSetup, checking, error, retry, authenticate, signOut }}>{children}</Context.Provider>;
}
export function useAuth() { const value = useContext(Context); if (!value) throw new Error('Hiányzó AuthProvider.'); return value; }
