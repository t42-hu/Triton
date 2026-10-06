import type { DisplayEvent, EventCategory } from './model';
import { searchableText } from './student';

export type UrgencyRules = { greenMinutes: number | null; yellowMinutes: number; redMinutes: number; green: string; yellow: string; red: string };
export type SeriesAppearance = { color?: string; urgency?: UrgencyRules };
export type EventColors = { lesson: UrgencyRules; deadline: UrgencyRules; series: Record<string, SeriesAppearance>; occurrences: Record<string, UrgencyRules> };
export const DEFAULT_EVENT_COLORS: EventColors = {
  lesson: { greenMinutes: null, yellowMinutes: 60, redMinutes: 10, green: '#4ade80', yellow: '#facc15', red: '#fb7185' },
  deadline: { greenMinutes: 10080, yellowMinutes: 4320, redMinutes: 1440, green: '#4ade80', yellow: '#facc15', red: '#fb7185' },
  series: {}, occurrences: {},
};
export const EVENT_PALETTE = ['#93b4f5', '#4ade80', '#facc15', '#fb7185', '#c084fc', '#22d3ee', '#fb923c'];
/** Retains the teaching format and group code; lecture and practice never share a color implicitly. */
export function colorSeriesKey(event: Pick<DisplayEvent, 'profileId' | 'originalTitle' | 'category'>): string {
  const code = event.originalTitle.match(/\b[A-Z0-9]+_(?:EA|GY|LA)(?:_\d+)?\b/i)?.[0];
  return JSON.stringify([event.profileId, event.category ?? 'lesson', searchableText(code ?? event.originalTitle)]);
}
export function colorOccurrenceKey(event: Pick<DisplayEvent, 'sourceId' | 'key'>): string { return JSON.stringify([event.sourceId, event.key]); }
export function isDeadline(category?: EventCategory): boolean { return category === 'assignment' || category === 'test' || category === 'exam'; }
/** Past events have no countdown tint; a lesson underway retains its imminent red outline. */
export function urgencyColor(start: number, end: number, now: number, rules: UrgencyRules, deadline = false): string | undefined {
  if (deadline ? start < now : end <= now) return undefined;
  const minutes = (start - now) / 60000;
  if (minutes <= rules.redMinutes) return rules.red;
  if (minutes <= rules.yellowMinutes) return rules.yellow;
  if (rules.greenMinutes === null || minutes <= rules.greenMinutes) return rules.green;
  return undefined;
}
export function eventAppearance(event: DisplayEvent, colors: EventColors, now: number): { color?: string; urgency?: string } {
  const series = colors.series[colorSeriesKey(event)];
  const deadline = isDeadline(event.category);
  const rules = colors.occurrences[colorOccurrenceKey(event)] ?? series?.urgency ?? (deadline ? colors.deadline : colors.lesson);
  const urgency = event.category === 'event' ? undefined : urgencyColor(event.start, event.end, now, rules, deadline);
  return { color: series?.color, urgency };
}
export function validateUrgencyRules(rules: UrgencyRules): void {
  if (!Number.isFinite(rules.redMinutes) || rules.redMinutes < 0 || !Number.isFinite(rules.yellowMinutes) || rules.yellowMinutes <= rules.redMinutes) throw new Error('A sárga küszöb legyen nagyobb a pirosnál, a percek pedig nem lehetnek negatívak.');
  if (rules.greenMinutes !== null && (!Number.isFinite(rules.greenMinutes) || rules.greenMinutes <= rules.yellowMinutes)) throw new Error('A zöld küszöb legyen nagyobb a sárgánál.');
  if (![rules.green, rules.yellow, rules.red].every(isHexColor)) throw new Error('Hatjegyű hexadecimális színt adj meg, például #4ade80.');
}
export function isHexColor(color: string): boolean { return /^#[0-9a-f]{6}$/i.test(color); }
