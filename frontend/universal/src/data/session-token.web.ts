/** Browser sessions use HttpOnly cookies; no bearer token enters browser storage. */
export async function sessionToken(): Promise<string | null> { return null; }
export async function setSessionToken(_token: string | null): Promise<void> {}
