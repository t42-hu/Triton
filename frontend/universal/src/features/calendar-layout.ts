import type { DisplayEvent } from '../domain/model';
import { addDays, fromWall, wallTime } from '../domain/time';
export const GRID_START = 0;
export const GRID_END = 24 * 60;
export const INITIAL_CALENDAR_MINUTE = 8 * 60;
export const GRID_MINUTES = GRID_END - GRID_START;
export type PositionedEvent = { event: DisplayEvent; top: number; height: number; lane: number; lanes: number };

/** Positions overlaps in separate lanes, resetting lane widths for each collision group. */
export function dayLayout(events: DisplayEvent[], date: string, gridStart = GRID_START, gridEnd = GRID_END): PositionedEvent[] {
  const gridMinutes = gridEnd - gridStart;
  const start = fromWall(`${date}T${String(gridStart / 60).padStart(2, '0')}:00`);
  const end = gridEnd === 24 * 60 ? fromWall(addDays(date, 1)) : fromWall(`${date}T${String(gridEnd / 60).padStart(2, '0')}:00`);
  const items = events.filter(event => event.kind === 'timed' && event.start < end && (event.end > start || event.start === event.end && event.start >= start));
  items.sort((first, second) => first.start - second.start || second.end - first.end);
  const positioned: PositionedEvent[] = []; let group: PositionedEvent[] = []; let laneEnds: number[] = [];
  for (const event of items) {
    const top = event.start < start ? 0 : minutes(event.start) - gridStart;
    const bottom = event.end >= end ? gridMinutes : minutes(event.end) - gridStart;
    if (laneEnds.length && top >= Math.max(...laneEnds)) { finishGroup(group, laneEnds.length); group = []; laneEnds = []; }
    let lane = laneEnds.findIndex(value => value <= top);
    if (lane < 0) lane = laneEnds.length;
    const height = Math.min(gridMinutes - top, Math.max(20, bottom - top)); laneEnds[lane] = top + height;
    const item = { event, top, height, lane, lanes: 1 }; group.push(item); positioned.push(item);
  }
  finishGroup(group, laneEnds.length); return positioned;
}
function finishGroup(group: PositionedEvent[], lanes: number): void { group.forEach(item => { item.lanes = lanes; }); }
function minutes(time: number): number { const value = wallTime(time); return Number(value.slice(11, 13)) * 60 + Number(value.slice(14, 16)); }
