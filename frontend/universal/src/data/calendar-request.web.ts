/** The same-origin server handles Neptun feeds which do not permit browser fetches. */
export async function calendarRequest(url: string, signal: AbortSignal): Promise<Response> {
  const useServer = new URL(url).hostname === 'neptun.uni-obuda.hu';
  const response = await fetch(useServer ? '/api/calendar-import' : url, {
    signal, credentials: useServer ? 'same-origin' : 'omit', referrerPolicy: 'no-referrer',
    ...(useServer ? { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ url }) } : {}),
  });
  if (useServer && !response.ok) {
    const result = await response.json().catch(() => ({})) as { error?: string };
    throw new Error(result.error || 'A naptár letöltése nem sikerült.');
  }
  if (!useServer && response.url && !response.url.startsWith('https://')) throw new Error('Nem biztonságos átirányítás.');
  return response;
}
