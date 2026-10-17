import { backend } from './backend';
import { offlineAccount, type OfflineAccount } from './offline-account';
import { isConnectionFailure } from './offline-account-model';
/** Only connectivity/server outages permit fallback; a rejected session never does. */
export async function restoreAccountSession(): Promise<{ user: OfflineAccount } | null> {
  try { return await backend<{ user: OfflineAccount } | null>('/auth/get-session'); }
  catch (error) {
    const user = isConnectionFailure(error) ? await offlineAccount() : null;
    if (!user) throw error;
    return { user };
  }
}
