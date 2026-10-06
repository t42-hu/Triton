/** Builds a Monday-first six-week calendar without depending on local timezone offsets. */
export function calendarDays(month: string): string[] {
  const [year, monthNumber] = month.split('-').map(Number);
  const firstDay = new Date(Date.UTC(year, monthNumber - 1, 1));
  const offset = (firstDay.getUTCDay() + 6) % 7;
  return Array.from({ length: 42 }, (_, index) => new Date(Date.UTC(year, monthNumber - 1, index - offset + 1)).toISOString().slice(0, 10));
}

/** Moves between months while preserving their first day, including year boundaries. */
export function shiftCalendarMonth(month: string, offset: number): string {
  const [year, monthNumber] = month.split('-').map(Number);
  return new Date(Date.UTC(year, monthNumber - 1 + offset, 1)).toISOString().slice(0, 7);
}
