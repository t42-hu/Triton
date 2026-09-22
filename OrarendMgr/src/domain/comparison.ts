import type { DisplayEvent, EventPatch } from './model';
import { clockTime, fromWall, wallTime } from './time';

/** Compares effective, visible event values; unknown rooms never imply attendance together. */
export function commonKeys(left: DisplayEvent[], right: DisplayEvent[]): Set<string> {
  const signatures = new Set(right.filter(event => !event.hidden && event.location.trim()).map(signature));
  return new Set(left.filter(event => !event.hidden && event.location.trim() && signatures.has(signature(event))).map(eventIdentity));
}
export function eventIdentity(event: Pick<DisplayEvent, 'sourceId' | 'key'>): string { return JSON.stringify([event.sourceId, event.key]); }
function signature(event: DisplayEvent): string {
  return JSON.stringify([event.title.trim().normalize('NFC'), event.start, event.end, event.location.trim().normalize('NFC')]);
}
/** A bulk time edit keeps each target date and applies the selected Budapest clock time. */
export function patchForTarget(patch: EventPatch, target: DisplayEvent): EventPatch {
  const result = { ...patch };
  const targetDate = wallTime(target.start).slice(0, 10);
  if (patch.start !== undefined) result.start = fromWall(`${targetDate}T${clockTime(patch.start)}:00`);
  if (patch.end !== undefined) result.end = fromWall(`${wallTime(target.end).slice(0, 10)}T${clockTime(patch.end)}:00`);
  return result;
}
