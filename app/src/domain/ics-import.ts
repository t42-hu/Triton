import ICAL from 'ical.js';
import type { DateRange, ImportControl, Occurrence } from './model';
import { addDays, fromWall, validateRange } from './time';
import { checkpoint, intersects } from './json-import';

function instant(time: ICAL.Time): number {
  if (time.isDate || time.zone.tzid === 'floating') return fromWall(time.toString());
  return time.toUnixTime() * 1000;
}
function ensureTimezone(component: ICAL.Component): void {
  for (const property of component.getAllProperties()) {
    const timezone = property.getParameter('tzid');
    if (typeof timezone === 'string' && !component.parent.getTimeZoneByID(timezone) && timezone !== 'UTC') throw new Error(`Hiányzó VTIMEZONE: ${timezone}`);
  }
}
function validateComponent(component: ICAL.Component): void {
  ensureTimezone(component);
  if (!component.getFirstPropertyValue('uid')) throw new Error('Hiányzó ICS UID.');
  if (!component.hasProperty('dtstart')) throw new Error('Hiányzó ICS DTSTART.');
  if (component.hasProperty('dtend') && component.hasProperty('duration')) throw new Error('DTEND és DURATION egyszerre nem használható.');
  const event = new ICAL.Event(component);
  if (!event.isRecurrenceException() && !event.summary?.trim()) throw new Error('Hiányzó eseménynév.');
  if (!Number.isFinite(instant(event.startDate)) || instant(event.endDate) < instant(event.startDate)) throw new Error('Hibás ICS időtartam.');

}
function toOccurrence(event: ICAL.Event, original?: ICAL.Time): Occurrence | undefined {
  const details = original ? event.getOccurrenceDetails(original) : undefined;
  const item = details?.item ?? event;
  if (item.component.getFirstPropertyValue('status') === 'CANCELLED') return undefined;
  const startDate = details?.startDate ?? item.startDate;
  const endDate = details?.endDate ?? item.endDate;
  const title = item.summary || event.summary;
  if (!title?.trim()) throw new Error('Hiányzó eseménynév.');
  return { key: JSON.stringify([event.uid, original ? `${original.toString()}@${original.zone.tzid}` : 'once']), title, originalTitle: title,
    start: instant(startDate), end: instant(endDate), location: item.location || event.location || '', kind: startDate.isDate ? 'allDay' : 'timed' };
}
function latestOriginal(event: ICAL.Event, end: number): number {
  const exceptions = Object.values(event.exceptions);
  const originals = exceptions.map(item => instant(item.recurrenceId));
  const shifts = exceptions.map(item => instant(item.startDate) - instant(item.recurrenceId));
  return Math.max(end - Math.min(0, ...shifts), ...originals);
}
async function* expandEvent(event: ICAL.Event, range: DateRange, control: ImportControl): AsyncGenerator<Occurrence> {
  if (!event.isRecurring()) { const item = toOccurrence(event); if (item && intersects(item, range)) yield item; return; }
  const periods = normalizePeriods(event.component);
  const startProperty = new ICAL.Property('rdate');
  startProperty.resetType(event.startDate.isDate ? 'date' : 'date-time');
  startProperty.setValue(event.startDate); event.component.addProperty(startProperty);
  const iterator = event.iterator();
  const limit = latestOriginal(event, fromWall(addDays(range.to, 1)));
  let count = 0; const seen = new Set<string>();
  for (let time = iterator.next(); time; time = iterator.next()) {
    await checkpoint(control, ++count);
    if (instant(time) > limit) break;
    const item = toOccurrence(event, time);
    const periodEnd = periods.get(time.toString());
    if (item && periodEnd !== undefined && !event.findRangeException(time) && !Object.hasOwn(event.exceptions, time.toString())) item.end = periodEnd;
    if (!item || !intersects(item, range) || seen.has(item.key)) continue;
    seen.add(item.key); yield item;
  }
}
/** Parses RFC calendar components; source errors abort the entire staged import. */
export async function* expandIcs(content: string, range: DateRange, control: ImportControl): AsyncGenerator<Occurrence> {
  validateRange(range.from, range.to);
  const calendar = ICAL.Component.fromString(content);
  if (calendar.name !== 'vcalendar') throw new Error('VCALENDAR fájl szükséges.');
  const components = calendar.getAllSubcomponents('vevent');
  components.forEach(validateComponent);
  const events = components.map(component => new ICAL.Event(component));
  const keys = events.map(event => `${event.uid}:${event.recurrenceId?.toString() ?? 'master'}`);
  if (new Set(keys).size !== keys.length) throw new Error('Ismétlődő ICS-azonosító.');
  const masters = events.filter(event => !event.isRecurrenceException());
  const masterIds = new Set(masters.map(event => event.uid));
  if (events.some(event => event.isRecurrenceException() && !masterIds.has(event.uid))) throw new Error('A kivételhez hiányzik az eredeti sorozat.');
  for (const event of masters) yield* expandEvent(event, range, control);
}

/** Preserves explicit RDATE period durations while letting ICAL expand their start dates. */
function normalizePeriods(component: ICAL.Component): Map<string, number> {
  const ends = new Map<string, number>();
  for (const property of component.getAllProperties('rdate').filter(item => item.type === 'period')) {
    const values: unknown[] = property.getValues();
    const periods = values.map(value => {
      if (!(value instanceof ICAL.Period)) throw new Error('Hibás RDATE periódus.');
      if (instant(value.getEnd()) <= instant(value.start)) throw new Error('Hibás RDATE időtartam.');
      ends.set(value.start.toString(), instant(value.getEnd())); return value.start;
    });
    property.resetType('date-time'); property.setValues(periods);
  }
  return ends;
}
