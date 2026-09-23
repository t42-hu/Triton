import type { DisplayEvent } from '../domain/model';
import { fromWall, wallTime } from '../domain/time';
export const GRID_START = 7 * 60;
export const GRID_END = 20 * 60;
export const GRID_MINUTES = GRID_END - GRID_START;
export type PositionedEvent = { event: DisplayEvent; top: number; height: number; lane: number; lanes: number };

/** Positions overlaps in separate lanes, resetting lane widths for each collision group. */
export function dayLayout(events: DisplayEvent[], date: string): PositionedEvent[] {
  const start = fromWall(`${date}T07:00`); const end = fromWall(`${date}T20:00`);
  const items = events.filter(event => event.kind === 'timed' && event.start < end && (event.end > start || event.start === event.end && event.start >= start));
  const positioned: PositionedEvent[] = []; let group: PositionedEvent[] = []; let laneEnds: number[] = [];
  for (const event of items) {
    const top = event.start < start ? 0 : minutes(event.start) - GRID_START;
    const bottom = event.end >= end ? GRID_MINUTES : minutes(event.end) - GRID_START;
    if (laneEnds.length && top >= Math.max(...laneEnds)) { finishGroup(group, laneEnds.length); group = []; laneEnds = []; }
    let lane = laneEnds.findIndex(value => value <= top);
    if (lane < 0) lane = laneEnds.length;
    const height = Math.min(GRID_MINUTES - top, Math.max(20, bottom - top)); laneEnds[lane] = top + height;
    const item = { event, top, height, lane, lanes: 1 }; group.push(item); positioned.push(item);
  }
  finishGroup(group, laneEnds.length); return positioned;
}
function finishGroup(group: PositionedEvent[], lanes: number): void { group.forEach(item => { item.lanes = lanes; }); }
function minutes(time: number): number { const value = wallTime(time); return Number(value.slice(11, 13)) * 60 + Number(value.slice(14, 16)); }
