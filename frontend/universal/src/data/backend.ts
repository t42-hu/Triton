import { Platform } from 'react-native';
import { sessionToken, setSessionToken, pendingChallenge, setPendingChallenge } from './session-token';
export class BackendError extends Error {
  constructor(message: string, readonly status: number) { super(message); }
}
const base = Platform.OS === 'web' ? '/api' : (process.env.EXPO_PUBLIC_API_URL || 'https://mobile.triton42.hu/api').replace(/\/$/, '');
export async function clearChallenge() { if (Platform.OS !== 'web') await setPendingChallenge(null); }
const expired = new Set<() => void>();
export function onSessionExpired(callback: () => void) { expired.add(callback); return () => { expired.delete(callback); }; }
/** Only this configured origin receives credentials; redirects never forward native sessions. */
export async function backend<T>(path: string, method = 'GET', body?: unknown, headers: Record<string, string> = {}): Promise<T> {
  const token = Platform.OS === 'web' ? null : await sessionToken();
  const challengeCookie = Platform.OS !== 'web' && path.startsWith('/auth/two-factor/') ? await pendingChallenge() : null;
  const nativeOrigin: Record<string, string> = Platform.OS === 'web' ? {} : { Origin: new URL(base).origin };
  const multipart = typeof FormData !== 'undefined' && body instanceof FormData;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), path.startsWith('/sync/') || path.startsWith('/calendar-files/sources/') ? 6000 : 20000);
  try {
    const response = await fetch(`${base}${path}`, {
      method, credentials: Platform.OS === 'web' ? 'include' : 'omit', redirect: 'error', signal: controller.signal,
      headers: { Accept: 'application/json', ...nativeOrigin, ...(body === undefined || multipart ? {} : { 'Content-Type': 'application/json' }), ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(Platform.OS !== 'web' && path.startsWith('/auth/two-factor/') && challengeCookie ? { Cookie: challengeCookie } : {}), ...headers },
      ...(body === undefined ? {} : { body: multipart ? body as FormData : JSON.stringify(body) }),
    });
    if (!response.headers.get('content-type')?.includes('application/json')) throw new BackendError('A szerver nem érhető el. Ellenőrizd a kapcsolatot.', response.status);
    const data = await response.json();
    if (!response.ok) {
      await expireSession(response.status, path);
      const invalidCredentials = path === '/auth/sign-in/email' && ['INVALID_EMAIL_OR_PASSWORD', 'INVALID_PASSWORD', 'USER_NOT_FOUND'].includes(data.code);
      throw new BackendError((response.status === 401 && !path.startsWith('/auth/two-factor/')) || invalidCredentials ? 'Hibás email-cím vagy jelszó, vagy ezzel az email-címmel még nincs regisztrált fiók. Ellenőrizd az adatokat, vagy regisztrálj.' : response.status === 409 ? 'Az adat másik eszközön megváltozott. Szinkronizálj újra.' : data.message || 'Nem sikerült a szerver művelete.', response.status);
    }
    await captureChallenge(response, data?.twoFactorRedirect);
    const issued = response.headers.get('set-auth-token');
    if (Platform.OS !== 'web' && issued) { await setSessionToken(issued); await clearChallenge(); }
    if (Platform.OS !== 'web' && path.startsWith('/auth/sign-') && path !== '/auth/sign-out' && !issued && !data?.twoFactorRedirect) throw new BackendError('A szerveren nincs engedélyezve a mobil bejelentkezés.', 503);
    return data as T;
  } catch (error) {
    if (error instanceof BackendError) throw error;
    throw new BackendError('Nem sikerült kapcsolódni a szerverhez. Próbáld újra.', 0);
  } finally { clearTimeout(timeout); }
}

async function expireSession(status: number, path: string) {
  if (status !== 401 || path.startsWith('/auth/sign-') || path.startsWith('/auth/two-factor/') || path === '/auth/change-password' || path === '/auth/delete-user') return;
  await setSessionToken(null); expired.forEach(callback => callback());
}

async function captureChallenge(response: Response, pending: unknown) {
  if (Platform.OS === 'web' || !pending) return;
  const cookies = response.headers.get('set-cookie') || '';
  const challengeCookie = cookies.split(/,(?=\s*[^;,\s]+=)/).map(value => value.trim().split(';')[0]).filter(value => /^[^=]*two_factor=/.test(value)).join('; ');
  if (!challengeCookie) throw new BackendError('A kétlépcsős belépéshez hiányzik a szerver munkamenete.', 503);
  await setPendingChallenge(challengeCookie);
}
