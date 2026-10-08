import * as SecureStore from 'expo-secure-store';
const key = 'triton42.session';
export const sessionToken = () => SecureStore.getItemAsync(key);
export async function setSessionToken(token: string | null) {
  if (token) await SecureStore.setItemAsync(key, token);
  else await SecureStore.deleteItemAsync(key);
}
