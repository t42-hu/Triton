import type { DisplayEvent, Profile } from './model';
import { wallTime } from './time';

function escapeText(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/\r?\n/g, '\\n').replace(/,/g, '\\,').replace(/;/g, '\\;');
}
function utcDate(timestamp: number): string {
  return new Date(timestamp).toISOString().replace(/[-:]/g, '').slice(0, 15) + 'Z';
}
/** Folds at 75 UTF-8 bytes without splitting a Unicode character. */
export function foldCalendarLine(line: string): string {
  const encoder = new TextEncoder(); let width = 0; let result = '';
  for (const character of line) {
    const bytes = encoder.encode(character).length;
    if (width + bytes > 75) { result += '\r\n '; width = 1; }
    result += character; width += bytes;
  }
  return result;
}
function eventLines(event: DisplayEvent, timestamp: string): string[] {
  const dates = event.kind === 'allDay'
    ? [`DTSTART;VALUE=DATE:${wallTime(event.start).slice(0, 10).replace(/-/g, '')}`, `DTEND;VALUE=DATE:${wallTime(event.end).slice(0, 10).replace(/-/g, '')}`]
    : [`DTSTART:${utcDate(event.start)}`, `DTEND:${utcDate(event.end)}`];
  return ['BEGIN:VEVENT', `UID:${encodeURIComponent(`${event.sourceId}:${event.key}`)}@triton.local`, `DTSTAMP:${timestamp}`, ...dates,
    `SUMMARY:${escapeText(event.title)}`, `X-TRITON-CATEGORY:${event.category ?? 'lesson'}`, `LOCATION:${escapeText(event.location)}`, `DESCRIPTION:${escapeText(event.notes ?? '')}`, 'END:VEVENT'];
}
/** Exports effective visible occurrences; all-day end dates remain exclusive. */
export function exportCalendar(profile: Profile, events: DisplayEvent[], now = Date.now()): string {
  const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Triton42//Timetable//HU', 'CALSCALE:GREGORIAN', `X-WR-CALNAME:${escapeText(profile.name)}`,
    ...events.filter(event => !event.hidden).flatMap(event => eventLines(event, utcDate(now))), 'END:VCALENDAR'];
  return lines.map(foldCalendarLine).join('\r\n') + '\r\n';
}
