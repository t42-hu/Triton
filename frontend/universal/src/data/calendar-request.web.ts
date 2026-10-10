/** The same-origin server handles Neptun feeds which do not permit browser fetches. */
export async function calendarRequest(url: string, signal: AbortSignal): Promise<Response> {
  const parsed = new URL(url);
  const useServer = parsed.hostname === 'neptun.uni-obuda.hu';
  const isTritonShare = parsed.origin === 'https://mobile.triton42.hu' && /^\/api\/calendar-share\/[a-f0-9-]{36}\/[A-Za-z0-9_-]{43}\/calendar\.ics$/.test(parsed.pathname) && !parsed.search;
  const target = useServer ? '/api/calendar-import' : isTritonShare ? parsed.pathname : url;
  const response = await fetch(target, {
    signal, credentials: useServer ? 'same-origin' : 'omit', referrerPolicy: 'no-referrer',
    ...(useServer ? { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ url }) } : {}),
  });
  if (useServer && !response.ok) {
    const result = await response.json().catch(() => ({})) as { error?: string };
    throw new Error(result.error || 'A naptár letöltése nem sikerült.');
  }
  if (!useServer && !isTritonShare && response.url && !response.url.startsWith('https://')) throw new Error('Nem biztonságos átirányítás.');
  return response;
}
