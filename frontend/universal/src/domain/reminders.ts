import type { Occurrence } from './model';

export const REMINDER_PROFILES = [
  { value: 'gentle', label: 'Finom', channelId: 'triton-reminder-gentle', vibration: [0, 150] },
  { value: 'standard', label: 'Normál', channelId: 'triton-reminder-standard', vibration: [0, 250, 200, 250] },
  { value: 'strong', label: 'Erős', channelId: 'triton-reminder-strong', vibration: [0, 500, 150, 500, 150, 500] },
] as const;
export type ReminderProfile = typeof REMINDER_PROFILES[number]['value'];
export type ReminderRule = { minutes: number; profile: ReminderProfile };
export type GlobalReminders = { enabled: boolean; rules: ReminderRule[] };
export type EventReminders = { excludeGlobal: boolean; rules: ReminderRule[] };
export type ReminderEvent = Occurrence & { sourceId: string; isOwn: number; hidden: number; reminders: EventReminders };
export type PlannedReminder = { id: string; at: number; title: string; body: string; channelId: string; fingerprint: string };
export const DEFAULT_REMINDERS: GlobalReminders = { enabled: false, rules: [{ minutes: 60, profile: 'gentle' }, { minutes: 20, profile: 'standard' }, { minutes: 5, profile: 'strong' }] };
export const EMPTY_EVENT_REMINDERS: EventReminders = { excludeGlobal: false, rules: [] };
export const REMINDER_PREFIX = 'triton-reminder:';
export const REMINDER_WINDOW = 30 * 86400000;

/** Bounds user input before it reaches SQLite or the operating system scheduler. */
export function validateReminderRules(rules: readonly ReminderRule[]): void {
  if (rules.length > 20) throw new Error('Legfeljebb 20 előjelzést adhatsz meg.');
  for (const rule of rules) {
    if (!Number.isInteger(rule.minutes) || rule.minutes < 1 || rule.minutes > 10080) throw new Error('Az előjelzés 1–10080 egész perc lehet.');
    if (!REMINDER_PROFILES.some(profile => profile.value === rule.profile)) throw new Error('Ismeretlen jelzőprofil.');
  }
  if (new Set(rules.map(rule => rule.minutes)).size !== rules.length) throw new Error('Ugyanaz az előjelzési idő csak egyszer adható meg.');
}
/** Explicit rules win at the same offset; global reminders never apply to peers. */
export function effectiveReminders(event: ReminderEvent, global: GlobalReminders): ReminderRule[] {
  const inherited = event.isOwn && global.enabled && !event.reminders.excludeGlobal ? global.rules : [];
  const rules = new Map(inherited.map(rule => [rule.minutes, rule]));
  for (const rule of event.reminders.rules) rules.set(rule.minutes, rule);
  return [...rules.values()];
}
function reminderFor(event: ReminderEvent, rule: ReminderRule): PlannedReminder {
  const channel = REMINDER_PROFILES.find(profile => profile.value === rule.profile)!;
  const id = REMINDER_PREFIX + JSON.stringify([event.sourceId, event.key, rule.minutes]);
  const at = event.start - rule.minutes * 60000;
  const title = event.title;
  const body = `${rule.minutes} perc múlva kezdődik${event.location ? ` · ${event.location}` : ''}`;
  return { id, at, title, body, channelId: channel.channelId, fingerprint: JSON.stringify([at, title, body, channel.channelId]) };
}
/** Uses absolute event instants, including overrides and DST; expired offsets are never replayed. */
export function planReminders(events: ReminderEvent[], global: GlobalReminders, now: number, limit = 60): PlannedReminder[] {
  function forEvent(event: ReminderEvent) { return effectiveReminders(event, global).map(rule => reminderFor(event, rule)); }
  const planned = events.filter(event => !event.hidden).flatMap(forEvent);
  return planned.filter(item => item.at > now && item.at <= now + REMINDER_WINDOW).sort((a, b) => a.at - b.at || a.id.localeCompare(b.id)).slice(0, limit);
}
/** Cancels only Triton class reminders; unrelated change notifications are left intact. */
export function reminderDifference(planned: PlannedReminder[], pending: { id: string; fingerprint?: unknown }[]) {
  const desired = new Map(planned.map(item => [item.id, item.fingerprint]));
  const existing = new Map(pending.map(item => [item.id, item.fingerprint]));
  return {
    cancel: pending.filter(item => item.id.startsWith(REMINDER_PREFIX) && (!desired.has(item.id) || desired.get(item.id) !== item.fingerprint)).map(item => item.id),
    schedule: planned.filter(item => existing.get(item.id) !== item.fingerprint),
  };
}
