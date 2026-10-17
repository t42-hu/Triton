import * as SecureStore from 'expo-secure-store';
import { sessionToken } from './session-token';
import { parseOfflineAccount, type OfflineAccount } from './offline-account-model';
export type { OfflineAccount } from './offline-account-model';
const key = 'triton42.offline-account';
/** Only a previously authenticated account with a retained session can open its local cache. */
export async function offlineAccount(): Promise<OfflineAccount | null> {
  if (!await sessionToken()) return null;
  return parseOfflineAccount(await SecureStore.getItemAsync(key));
}
export async function rememberOfflineAccount(user: OfflineAccount | null) {
  if (user) await SecureStore.setItemAsync(key, JSON.stringify({ id: user.id, email: user.email, name: user.name }));
  else await SecureStore.deleteItemAsync(key);
}
