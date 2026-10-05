import type { DisplayEvent } from '../domain/model';
import { freeSlots, type TimeSlot } from '../domain/schedule-analysis';
import { addDays, fromWall, wallTime } from '../domain/time';
import { sources, visibleEvents } from './repository';

type Coverage = { fromDate: string; toDate: string; isManual: number | boolean };
export type FreeTimeResult = { slots: TimeSlot[]; missing: { date: string; profileIds: number[] }[] };

/** Keeps each verified Budapest calendar day separate, including daylight-saving boundaries. */
export function coveredWindows(profiles: { id: number; sources: Coverage[] }[], start: number, end: number) {
  const windows: TimeSlot[] = []; const missing: FreeTimeResult['missing'] = [];
  for (let date = wallTime(start).slice(0, 10); fromWall(date) < end; date = addDays(date, 1)) {
    function coversDay(source: Coverage) { return !source.isManual && source.fromDate <= date && source.toDate >= date; }
    function lacksCoverage(profile: typeof profiles[number]) { return !profile.sources.some(coversDay); }
    const profileIds = profiles.filter(lacksCoverage).map(profile => profile.id);
    if (profileIds.length) { missing.push({ date, profileIds }); continue; }
    const slot = { start: Math.max(start, fromWall(date)), end: Math.min(end, fromWall(addDays(date, 1))) };
    windows.push(slot);
  }
  return { windows, missing };
}

/** Finds maximal free intervals within each verified day without joining evenings to the next morning. */
export async function findCommonFreeTime(ids: number[], start: number, end: number, minimumMinutes: number): Promise<FreeTimeResult> {
  if (!Number.isFinite(minimumMinutes) || minimumMinutes < 1) throw new Error('Pozitív minimum időtartam szükséges.');
  if (ids.length < 2 || !Number.isFinite(start) || !Number.isFinite(end) || end <= start || end - start > 366 * 86400000) throw new Error('Legalább két profil és legfeljebb egyéves, érvényes időtartomány szükséges.');
  const firstDate = wallTime(start).slice(0, 10);
  const days = Math.ceil((end - fromWall(firstDate)) / 86400000) + 1;
  async function load(id: number) { return { id, sources: await sources(id), events: await visibleEvents(id, firstDate, days, false) }; }
  const profiles = await Promise.all(ids.map(load));
  const events: DisplayEvent[] = profiles.flatMap(profile => profile.events);
  const { windows, missing } = coveredWindows(profiles, start, end);
  return { slots: windows.flatMap(window => freeSlots(events, window.start, window.end, minimumMinutes)), missing };
}
