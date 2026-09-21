import type { DisplayEvent } from '../domain/model';
import { addDays, fromWall, wallTime } from '../domain/time';
export type PositionedEvent = { event: DisplayEvent; top: number; height: number; lane: number; lanes: number };

/** Positions overlaps in separate lanes, resetting lane widths for each collision group. */
export function dayLayout(events: DisplayEvent[], date: string): PositionedEvent[] {
  const start = fromWall(date); const end = fromWall(addDays(date, 1));
  const items = events.filter(event => event.kind === 'timed' && event.start < end && (event.end > start || event.start === event.end && event.start >= start));
  const positioned: PositionedEvent[] = []; let group: PositionedEvent[] = []; let laneEnds: number[] = [];
  for (const event of items) {
    const top = event.start < start ? 0 : minutes(event.start);
    const bottom = event.end >= end ? 1440 : minutes(event.end);
    if (laneEnds.length && top >= Math.max(...laneEnds)) { finishGroup(group, laneEnds.length); group = []; laneEnds = []; }
    let lane = laneEnds.findIndex(value => value <= top);
    if (lane < 0) lane = laneEnds.length;
    const height = Math.max(20, bottom - top); laneEnds[lane] = top + height;
    const item = { event, top, height, lane, lanes: 1 }; group.push(item); positioned.push(item);
  }
  finishGroup(group, laneEnds.length); return positioned;
}
function finishGroup(group: PositionedEvent[], lanes: number): void { group.forEach(item => { item.lanes = lanes; }); }
function minutes(time: number): number { const value = wallTime(time); return Number(value.slice(11, 13)) * 60 + Number(value.slice(14, 16)); }
