export type OfflineAccount = { id: string; email: string; name: string; image?: string | null; twoFactorEnabled?: boolean };
export function parseOfflineAccount(value: string | null): OfflineAccount | null {
  try {
    const user = JSON.parse(value ?? 'null');
    return user && typeof user.id === 'string' && typeof user.email === 'string' && typeof user.name === 'string' ? { id: user.id, email: user.email, name: user.name } : null;
  } catch { return null; }
}
/** Authentication failures must never unlock cached account data. */
export function isConnectionFailure(error: unknown): boolean {
  const status = (error as { status?: number } | null)?.status;
  return status === 0 || (typeof status === 'number' && status >= 500);
}
