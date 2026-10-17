import * as SecureStore from 'expo-secure-store';
const key = 'triton42.session';
export const sessionToken = () => SecureStore.getItemAsync(key);
export async function setSessionToken(token: string | null) {
  if (token) await SecureStore.setItemAsync(key, token);
  else await SecureStore.deleteItemAsync(key);
}

const challengeKey = 'triton42.email-challenge';
export async function pendingChallenge(): Promise<string | null> {
  const value = await SecureStore.getItemAsync(challengeKey);
  if (!value) return null;
  try {
    const saved = JSON.parse(value) as { cookie: string; expiresAt: number };
    if (saved.expiresAt > Date.now() && typeof saved.cookie === 'string') return saved.cookie;
  } catch { /* Discard obsolete or damaged challenge data. */ }
  await setPendingChallenge(null); return null;
}
export async function setPendingChallenge(cookie: string | null) {
  if (cookie) await SecureStore.setItemAsync(challengeKey, JSON.stringify({ cookie, expiresAt: Date.now() + 600000 }));
  else await SecureStore.deleteItemAsync(challengeKey);
}
