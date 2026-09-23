import type { Anchor, CalendarEvent, DateRange, ImportControl, Occurrence, Recurrence } from './model';
import { addDays, fromWall, validDate, validateRange, wallTime, weekAt } from './time';

function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Objektum szükséges.');
  return value as Record<string, unknown>;
}
function recurrence(value: unknown): Recurrence | undefined {
  if (value === undefined) return undefined;
  const item = record(value);
  if (item.frequency !== 'weekly' || !['all', 'A', 'B'].includes(String(item.weeks)) || !validDate(String(item.until))) throw new Error('Hibás heti ismétlődés.');
  return { frequency: 'weekly', weeks: item.weeks as Recurrence['weeks'], until: String(item.until) };
}
function eventTime(value: unknown, allDay: boolean): string {
  if (typeof value !== 'string') throw new Error('Hiányzó időpont.');
  if (allDay && validDate(value)) return value;
  if (!allDay && /^\d{4}-\d{2}-\d{2}T(?:[01]\d|2[0-3]):[0-5]\d(:[0-5]\d(\.\d+)?)?(Z|[+-](?:[01]\d|2[0-3]):[0-5]\d)$/.test(value) && validDate(value.slice(0, 10)) && Number.isFinite(Date.parse(value))) return value;
  throw new Error('Időzónás ISO-időpont vagy egész napos dátum szükséges.');
}
/** Validates external structured data before it can replace an existing source. */
export function parseJson(content: string): CalendarEvent[] {
  const root = record(JSON.parse(content));
  if (root.version !== 1 || !Array.isArray(root.events)) throw new Error('A fájl version: 1 és events mezőket igényel.');
  const events = root.events.map(parseEvent);
  if (new Set(events.map(event => event.id)).size !== events.length) throw new Error('Ismétlődő eseményazonosító.');
  return events;
}
function parseEvent(value: unknown): CalendarEvent {
  const item = record(value);
  if (typeof item.id !== 'string' || !item.id.trim() || typeof item.title !== 'string' || !item.title.trim()) throw new Error('Minden eseményhez id és cím szükséges.');
  if (item.kind !== 'timed' && item.kind !== 'allDay') throw new Error('Ismeretlen eseménytípus.');
  if (item.location !== undefined && typeof item.location !== 'string') throw new Error('A terem szöveg legyen.');
  const start = eventTime(item.start, item.kind === 'allDay');
  const end = eventTime(item.end, item.kind === 'allDay');
  const repeat = recurrence(item.recurrence);
  if (Date.parse(end) <= Date.parse(start)) throw new Error('A befejezésnek a kezdés után kell lennie.');
  if (repeat && repeat.until < start.slice(0, 10)) throw new Error('Az ismétlődés vége korábbi a kezdésnél.');
  return { id: item.id, title: item.title.trim(), kind: item.kind, start, end, location: item.location, recurrence: repeat };
}
function occurrence(event: CalendarEvent, date?: string): Occurrence {
  const allDay = event.kind === 'allDay';
  const baseStart = allDay ? event.start : wallTime(Date.parse(event.start));
  const baseEnd = allDay ? event.end : wallTime(Date.parse(event.end));
  const days = Math.round((Date.parse(baseEnd.slice(0, 10)) - Date.parse(baseStart.slice(0, 10))) / 86400000);
  const start = date ? fromWall(date + baseStart.slice(10)) : allDay ? fromWall(event.start) : Date.parse(event.start);
  const end = date ? fromWall(addDays(date, days) + baseEnd.slice(10)) : allDay ? fromWall(event.end) : Date.parse(event.end);
  return { key: JSON.stringify([event.id, date ?? 'once']), title: event.title, originalTitle: event.title, start, end, location: event.location ?? '', kind: event.kind };
}
export async function checkpoint(control: ImportControl, count: number): Promise<void> {
  if (control.signal.aborted) throw new Error('Import megszakítva.');
  if (count > 2000000) throw new Error('Az ismétlődés túl sok lépést igényel. Szűkítsd a forrást.');
  if (count % 100 !== 0) return;
  control.progress(count);
  await new Promise(resolve => setTimeout(resolve, 0));
}
/** Expands only the requested period, preserving Budapest wall-clock recurrence. */
export async function* expandJson(content: string, range: DateRange, anchor: Anchor, control: ImportControl): AsyncGenerator<Occurrence> {
  validateRange(range.from, range.to);
  let count = 0;
  for (const event of parseJson(content)) {
    for (const item of eventOccurrences(event, range, anchor)) {
      await checkpoint(control, ++count);
      yield item;
    }
  }
}
function* eventOccurrences(event: CalendarEvent, range: DateRange, anchor: Anchor): Generator<Occurrence> {
  if (!event.recurrence) { const item = occurrence(event); if (intersects(item, range)) yield item; return; }
  const first = event.kind === 'allDay' ? event.start : wallTime(Date.parse(event.start)).slice(0, 10);
  const last = event.recurrence.until < range.to ? event.recurrence.until : range.to;
  for (let date = first; date <= last; date = addDays(date, 7)) {
    const item = occurrence(event, date);
    if (intersects(item, range) && (event.recurrence.weeks === 'all' || weekAt(date, anchor) === event.recurrence.weeks)) yield item;
  }
}
export function intersects(item: Occurrence, range: DateRange): boolean {
  return item.start < fromWall(addDays(range.to, 1)) && (item.end > fromWall(range.from) || item.start === item.end && item.start >= fromWall(range.from));
}
