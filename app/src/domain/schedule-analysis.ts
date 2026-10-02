import type { DisplayEvent } from './model';
import { addDays, fromWall } from './time';

export type TimeSlot = { start: number; end: number };
export type ScheduleConflict = { first: DisplayEvent; second: DisplayEvent; start: number; end: number };

/** Assignments are deadlines, rather than reserved time; hidden events never occupy a slot. */
export function blocksTime(event: DisplayEvent): boolean {
  return !event.hidden && event.category !== 'assignment' && event.end > event.start;
}

/** Merges overlapping and adjacent intervals without counting the same minute twice. */
export function occupiedSlots(events: DisplayEvent[], start: number, end: number): TimeSlot[] {
  const slots = events.filter(blocksTime).map(event => ({ start: Math.max(start, event.start), end: Math.min(end, event.end) })).filter(slot => slot.end > slot.start).sort((a, b) => a.start - b.start);
  const merged: TimeSlot[] = [];
  for (const slot of slots) {
    const previous = merged.at(-1);
    if (!previous || slot.start > previous.end) { merged.push({ ...slot }); continue; }
    previous.end = Math.max(previous.end, slot.end);
  }
  return merged;
}

/** Uses half-open intervals: consecutive events do not conflict. */
export function scheduleConflicts(events: DisplayEvent[]): ScheduleConflict[] {
  const sorted = events.filter(blocksTime).sort((a, b) => a.start - b.start);
  let active: DisplayEvent[] = [];
  const conflicts: ScheduleConflict[] = [];
  for (const event of sorted) {
    active = active.filter(previous => previous.end > event.start);
    const overlaps = active.map(previous => ({ first: previous, second: event, start: event.start, end: Math.min(previous.end, event.end) }));
    conflicts.push(...overlaps);
    active.push(event);
  }
  return conflicts;
}

/** Returns free intervals inside explicit daily boundaries, including empty days. */
export function freeSlots(events: DisplayEvent[], start: number, end: number, minimumMinutes = 30): TimeSlot[] {
  if (end <= start || minimumMinutes < 1) return [];
  const result: TimeSlot[] = [];
  let cursor = start;
  for (const slot of occupiedSlots(events, start, end)) {
    if (slot.start - cursor >= minimumMinutes * 60000) result.push({ start: cursor, end: slot.start });
    cursor = slot.end;
  }
  if (end - cursor >= minimumMinutes * 60000) result.push({ start: cursor, end });
  return result;
}

/** Reports actual timed occupancy; all-day events are listed separately in the UI. */
export function dailyAnalysis(events: DisplayEvent[], date: string) {
  const start = fromWall(date); const end = fromWall(addDays(date, 1));
  const daily = events.filter(event => !event.hidden && event.start < end && event.end > start);
  const timed = daily.filter(event => event.kind === 'timed');
  const occupied = occupiedSlots(timed, start, end);
  const first = occupied[0]?.start; const last = occupied.at(-1)?.end;
  const gaps = first !== undefined && last !== undefined ? freeSlots(timed, first, last, 1) : [];
  const minutes = occupied.reduce((total, slot) => total + (slot.end - slot.start) / 60000, 0);
  return { minutes, gaps, conflicts: scheduleConflicts(timed), lessonCount: daily.filter(event => (event.category ?? 'lesson') === 'lesson').length };
}
