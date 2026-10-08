import { commonBreaks, type TimeSlot } from '../domain/schedule-analysis';
import { addDays, fromWall, wallTime } from '../domain/time';
import { visibleEvents } from './repository';

export type FreeTimeResult = { slots: TimeSlot[] };

/** Keeps Budapest calendar days separate, including daylight-saving boundaries. */
export function dailyWindows(start: number, end: number): TimeSlot[] {
  const windows: TimeSlot[] = [];
  for (let date = wallTime(start).slice(0, 10); fromWall(date) < end; date = addDays(date, 1)) {
    windows.push({ start: Math.max(start, fromWall(date)), end: Math.min(end, fromWall(addDays(date, 1))) });
  }
  return windows;
}

/** Finds maximal free intervals within each event day without joining evenings to the next morning. */
export async function findCommonFreeTime(ids: number[], start: number, end: number, minimumMinutes: number): Promise<FreeTimeResult> {
  if (!Number.isFinite(minimumMinutes) || minimumMinutes < 1) throw new Error('Pozitív minimum időtartam szükséges.');
  if (ids.length < 2 || !Number.isFinite(start) || !Number.isFinite(end) || end <= start || end - start > 366 * 86400000) throw new Error('Legalább két profil és legfeljebb egyéves, érvényes időtartomány szükséges.');
  const firstDate = wallTime(start).slice(0, 10);
  const days = Math.ceil((end - fromWall(firstDate)) / 86400000) + 1;
  async function load(id: number) { return visibleEvents(id, firstDate, days, false); }
  const participants = await Promise.all(ids.map(load));
  const windows = dailyWindows(start, end);
  return { slots: windows.flatMap(window => {
    const date = wallTime(window.start).slice(0, 10);
    return commonBreaks(participants, fromWall(date), fromWall(addDays(date, 1)), window.start, window.end, minimumMinutes);
  }) };
}
