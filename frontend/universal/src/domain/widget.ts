import type { DisplayEvent } from './model';
import { addDays, clockTime, dateLabel, fromWall, wallTime } from './time';

export type WidgetEvent = { title: string; location: string; start: number; end: number; allDay: boolean; time: string };
export type WidgetDay = { date: string; label: string; start: number; end: number; events: WidgetEvent[] };
export type WidgetData = { updated: number; days: WidgetDay[] };

/** A bounded, private snapshot: no account IDs, feed URLs, notes or session tokens. */
export function widgetData(events: DisplayEvent[], now: number): WidgetData {
  const first = wallTime(now).slice(0, 10);
  return { updated: now, days: Array.from({ length: 8 }, (_, index) => makeDay(events, addDays(first, index))) };
}
function makeDay(events: DisplayEvent[], date: string): WidgetDay {
  const start = fromWall(date), end = fromWall(addDays(date, 1));
  return { date, label: dateLabel(date), start, end, events: events
    .filter(event => !event.hidden && event.start < end && (event.end > start || event.end === event.start && event.start >= start))
    .sort((a, b) => a.start - b.start || a.end - b.end || a.key.localeCompare(b.key))
    .map(event => ({ title: event.title, location: event.location, start: event.start, end: event.end, allDay: event.kind === 'allDay', time: event.kind === 'allDay' ? 'Egész nap' : `${clockTime(event.start)}–${clockTime(event.end)}` })) };
}

/** In-progress events stay visible; ended events leave the top of the agenda. */
export function widgetAgenda(data: WidgetData, now: number): { day?: WidgetDay; events: WidgetEvent[] } {
  const day = data.days.find(item => now >= item.start && now < item.end);
  return { day, events: day?.events.filter(event => event.allDay || event.end > now || event.start === event.end && event.start >= now) ?? [] };
}

/** Native timeline entries advance without requiring the main app to stay open. */
export function widgetBoundaries(data: WidgetData, now: number): number[] {
  return [...new Set([now, ...data.days.flatMap(dayBoundaries)])].filter(at => at >= now).sort((a, b) => a - b);
}
function dayBoundaries(day: WidgetDay): number[] {
  const dst = day.end - day.start === 86400000 ? [] : [1, 2, 3, 4].map(hour => day.start + hour * 3600000);
  return [day.start, day.end, ...dst, ...day.events.flatMap(event => [event.start, event.end + Number(event.start === event.end)])];
}
/** Live clock anchor adjusts at DST transitions instead of displaying elapsed hours since midnight. */
export function widgetClockAnchor(at: number): number {
  const clock = wallTime(at).slice(11).split(':').map(Number);
  return Math.floor(at / 1000) * 1000 - (clock[0] * 3600 + clock[1] * 60 + clock[2]) * 1000;
}
