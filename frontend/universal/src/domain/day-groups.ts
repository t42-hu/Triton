import { wallTime } from './time';

/** Groups deadlines by institutional date without changing their order or identity. */
export function groupByBudapestDate<T extends { start: number }>(items: readonly T[]): { date: string; items: T[] }[] {
  const groups = new Map<string, T[]>();
  for (const item of items) {
    const date = wallTime(item.start).slice(0, 10);
    const group = groups.get(date);
    if (group) group.push(item);
    else groups.set(date, [item]);
  }
  return Array.from(groups, ([date, items]) => ({ date, items }));
}
