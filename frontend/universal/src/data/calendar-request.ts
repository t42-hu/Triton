/** Native downloads do not have the browser's cross-origin restriction. */
export async function calendarRequest(url: string, signal: AbortSignal): Promise<Response> {
  const response = await fetch(url, { signal, credentials: 'omit', referrerPolicy: 'no-referrer' });
  if (response.url && !response.url.startsWith('https://')) throw new Error('Nem biztonságos átirányítás.');
  return response;
}
