import { parseOfflineAccount, type OfflineAccount } from './offline-account-model';
export type { OfflineAccount } from './offline-account-model';
const key = 'triton42.offline-account';
/** A summary identifies the local cache; HttpOnly cookies remain the only web credentials. */
export async function offlineAccount(): Promise<OfflineAccount | null> {
  try { return parseOfflineAccount(localStorage.getItem(key)); } catch { return null; }
}
export async function rememberOfflineAccount(user: OfflineAccount | null) {
  try {
    if (user) localStorage.setItem(key, JSON.stringify({ id: user.id, email: user.email, name: user.name }));
    else localStorage.removeItem(key);
  } catch { /* Browsers may disable persistent storage; online use still works. */ }
}
