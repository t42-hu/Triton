import { readCalendarResponse } from './calendar-response';
import { calendarRequest } from './calendar-request';
export { MAX_CALENDAR_BYTES } from './calendar-response';

/** Accepts subscription URLs without sending cookies or embedded login credentials. */
export function calendarUrl(input: string): string {
  let url: URL;
  try { url = new URL(input.trim().replace(/^webcal:/i, 'https:')); }
  catch { throw new Error('Érvényes HTTPS naptárlinket adj meg.'); }
  if (url.protocol !== 'https:' || url.username || url.password) throw new Error('Csak jelszó nélküli HTTPS naptárlink használható.');
  url.hash = '';
  return url.href;
}

/** Bounds download time and size; remote errors never expose the private feed URL. */
export async function fetchCalendar(input: string, signal?: AbortSignal): Promise<string> {
  const url = calendarUrl(input);
  const controller = new AbortController();
  const abort = () => controller.abort();
  signal?.addEventListener('abort', abort);
  if (signal?.aborted) abort();
  const timeout = setTimeout(abort, 30000);
  try {
    const response = await calendarRequest(url, controller.signal);
    return await readCalendarResponse(response);
  } catch (error) {
    if (controller.signal.aborted) throw new Error(signal?.aborted ? 'Letöltés megszakítva.' : 'A letöltés túllépte a 30 másodpercet.');
    if (error instanceof TypeError) throw new Error('A hálózat vagy a böngésző nem engedte a letöltést. Próbáld a fájlimportot.');
    throw error;
  } finally { clearTimeout(timeout); signal?.removeEventListener('abort', abort); }
}
