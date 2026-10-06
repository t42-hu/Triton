export const MAX_CALENDAR_BYTES = 5 * 1024 * 1024;

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
    const response = await fetch(url, { signal: controller.signal, credentials: 'omit', referrerPolicy: 'no-referrer' });
    if (!response.ok) throw new Error(`A naptár nem érhető el (HTTP ${response.status}).`);
    if (response.url && !response.url.startsWith('https://')) throw new Error('Nem biztonságos átirányítás.');
    const content = await readCalendar(response);
    if (!/^BEGIN:VCALENDAR\s/im.test(content) || !/END:VCALENDAR\s*$/i.test(content.trim())) throw new Error('A link nem teljes ICS naptárat adott vissza.');
    return content;
  } catch (error) {
    if (controller.signal.aborted) throw new Error(signal?.aborted ? 'Letöltés megszakítva.' : 'A letöltés túllépte a 30 másodpercet.');
    if (error instanceof TypeError) throw new Error('A hálózat vagy a böngésző nem engedte a letöltést. Próbáld a fájlimportot.');
    throw error;
  } finally { clearTimeout(timeout); signal?.removeEventListener('abort', abort); }
}

async function readCalendar(response: Response): Promise<string> {
  if (Number(response.headers.get('content-length')) > MAX_CALENDAR_BYTES) throw new Error('A letöltés legfeljebb 5 MB lehet.');
  const reader = response.body?.getReader();
  if (!reader) return checkSize(await response.text());
  try { return await readChunks(reader); } finally { await reader.cancel(); }
}
async function readChunks(reader: ReadableStreamDefaultReader<Uint8Array>): Promise<string> {
  const decoder = new TextDecoder();
  let size = 0; let content = '';
  for (;;) {
      const chunk = await reader.read();
      if (chunk.done) return content + decoder.decode();
      size += chunk.value.byteLength;
      if (size > MAX_CALENDAR_BYTES) throw new Error('A letöltés legfeljebb 5 MB lehet.');
      content += decoder.decode(chunk.value, { stream: true });
  }
}
function checkSize(content: string): string {
  if (new TextEncoder().encode(content).byteLength > MAX_CALENDAR_BYTES) throw new Error('A letöltés legfeljebb 5 MB lehet.');
  return content;
}
