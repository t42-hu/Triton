import type { DisplayEvent } from './model';
import { addDays, fromWall, wallTime } from './time';
export type DragGrid = { firstDate: string; days: number; dayWidth: number; zoom: number; startMinute: number; endMinute: number };
/** Snaps a drop inside the displayed days; elapsed duration and the other occurrence fields stay intact. */
export function eventDrop(event: DisplayEvent, columnDate: string, x: number, y: number, grid: DragGrid) {
  if (![x, y, grid.dayWidth, grid.zoom].every(Number.isFinite) || grid.dayWidth <= 0 || grid.zoom <= 0) throw new Error('Érvénytelen húzási pozíció.');
  const column = Math.round((Date.parse(columnDate) - Date.parse(grid.firstDate)) / 86400000);
  let offset = Math.max(-column, Math.min(grid.days - column - 1, Math.round(x / grid.dayWidth)));
  const original = wallTime(event.start);
  if (event.kind === 'allDay') {
    const span = Math.max(1, Math.round((Date.parse(wallTime(event.end).slice(0, 10)) - Date.parse(original.slice(0, 10))) / 86400000));
    offset = Math.max(-column, Math.min(grid.days - column - span, offset));
    const start = fromWall(addDays(original.slice(0, 10), offset));
    const end = fromWall(addDays(wallTime(event.end).slice(0, 10), offset));
    return { start, end, x: offset * grid.dayWidth, y: 0 };
  }
  const minute = Number(original.slice(11, 13)) * 60 + Number(original.slice(14, 16));
  const duration = event.end - event.start;
  const step = 5;
  const maximum = Math.max(grid.startMinute, Math.floor((grid.endMinute - Math.max(step, duration / 60000)) / step) * step);
  const target = Math.max(grid.startMinute, Math.min(maximum, Math.round((minute + y / grid.zoom) / step) * step));
  const date = addDays(columnDate, offset);
  const start = fromWall(`${date}T${String(Math.floor(target / 60)).padStart(2, '0')}:${String(Math.floor(target % 60)).padStart(2, '0')}`);
  return { start, end: start + duration, x: offset * grid.dayWidth, y: (target - minute) * grid.zoom };
}
