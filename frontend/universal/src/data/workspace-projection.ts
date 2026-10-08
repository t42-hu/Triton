import { DEFAULT_EVENT_COLORS, type EventColors, type UrgencyRules } from '@/domain/event-colors';
import { DEFAULT_REMINDERS, type GlobalReminders } from '@/domain/reminders';
import { wallTime } from '@/domain/time';

import type { ViewState } from '@/features/app-state';
import type { Anchor, Occurrence } from '@/domain/model';
import type { CloudRecord, LocalWorkspace, IdentityMap } from './workspace-types';
export type { CloudRecord, LocalWorkspace, IdentityMap } from './workspace-types';
export function stable(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stable).join(',')}]`;
  if (value && typeof value === 'object') return `{${Object.entries(value).filter(([, value]) => value !== undefined).sort(([a], [b]) => a.localeCompare(b)).map(([key, item]) => `${JSON.stringify(key)}:${stable(item)}`).join(',')}}`;
  return JSON.stringify(value);
}
/** Stable identifiers are persisted before sending, so interrupted uploads can be retried. */
export function projectWorkspace(local: LocalWorkspace, identities: IdentityMap, installation: string, deviceId: string): CloudRecord[] {
  const projector = new WorkspaceProjector(local, identities, installation, deviceId);
  projector.profiles(); projector.sources(); projector.tasks(); projector.preferences(); projector.palette(); projector.colors();
  return projector.result;
}
class WorkspaceProjector {
  readonly result: CloudRecord[] = [];
  readonly settings: Record<string, unknown>;
  readonly profileIds = new Map<number, string>();
  readonly calendars = new Map<number, string>();
  readonly eventIds = new Map<string, string>();
  constructor(readonly local: LocalWorkspace, readonly identities: IdentityMap, readonly installation: string, readonly deviceId: string) {
    this.settings = Object.fromEntries(local.settings.map(row => [row.key, JSON.parse(row.value)]));
  }
  id(key: string) { return this.identities[key] ??= `t-${this.installation}-${Object.keys(this.identities).length + 1}`; }
  add(resource: string, key: string, data: Record<string, unknown>) {
    const record = { resource, id: this.id(`${resource}:${key}`), data }; this.result.push(record); return record.id;
  }
  profiles() {
  for (const profile of this.local.profiles) {
    const profileId = this.add('profiles', String(profile.id), { name: profile.name, isOwn: Boolean(profile.isOwn) });
    this.profileIds.set(profile.id, profileId);
    const calendarId = this.add('calendars', String(profile.id), { name: profile.name, timezone: 'Europe/Budapest' });
    this.calendars.set(profile.id, calendarId);
    this.add('profile-calendars', String(profile.id), { profileId, calendarId, position: 0 });
  }
  }
  sources() { for (const source of this.local.sources) this.source(source); }
  source(source: LocalWorkspace['sources'][number]) {
    const calendarId = this.calendars.get(source.profileId);
    if (!calendarId) return;
    const sourceId = this.add('sources', source.id, { calendarId, name: source.name, format: source.isManual ? 'manual' : source.format, coverageFrom: source.fromDate, coverageTo: source.toDate });
    const connection = this.local.source_sync.find(row => row.sourceId === source.id);
    if (connection?.url) this.add('source-connections', source.id, { sourceId, url: connection.url, autoSync: Boolean(connection.autoSync) });
    for (const event of this.local.events.filter(row => row.sourceId === source.id)) this.event(source.id, sourceId, calendarId, event);
  }
  event(localSource: string, sourceId: string, calendarId: string, event: LocalWorkspace['events'][number]) {
    const base: Occurrence = JSON.parse(event.base);
    const eventId = this.add('events', JSON.stringify([localSource, event.key]), { calendarId, sourceId, externalUid: event.key, ...eventFields(base), category: event.category ?? base.category ?? 'lesson', timezone: 'Europe/Budapest' });
    this.eventIds.set(JSON.stringify([localSource, event.key]), eventId);
    const patch = this.local.overrides.find(row => row.sourceId === localSource && row.key === event.key);
    if (patch) {
      const { kind: _kind, ...fields } = eventFields({ ...base, ...JSON.parse(patch.patch) });
      this.add('overrides', JSON.stringify([localSource, event.key]), { eventId, occurrenceKey: '', ...fields, hidden: Boolean(event.hidden) });
    }
    this.eventReminders(localSource, event.key, eventId);
  }
  eventReminders(sourceId: string, key: string, eventId: string) {
    const reminders = this.local.event_reminders.find(row => row.sourceId === sourceId && row.key === key);
    if (!reminders) return;
    this.add('event-reminder-settings', JSON.stringify([sourceId, key]), { eventId, excludeGlobal: Boolean(reminders.excludeGlobal) });
    const rules: GlobalReminders['rules'] = JSON.parse(reminders.rules);
    for (const rule of rules) this.add('reminder-rules', JSON.stringify([sourceId, key, rule.minutes]), { eventId, minutes: rule.minutes, profile: rule.profile });
  }
  tasks() {
  for (const task of this.local.lesson_tasks) this.add('tasks', task.id, { profileId: this.profileIds.get(task.profileId), title: task.title, completed: Boolean(task.completed), eventId: this.eventIds.get(JSON.stringify([task.sourceId, task.eventKey])) ?? null, dueAt: new Date(task.due).toISOString(), eventTitle: task.eventTitle });
  for (const link of this.local.notebook_links) this.add('notebook-links', link.id, { profileId: this.profileIds.get(link.profileId), subjectKey: link.notebookKey, subject: link.subject, title: link.title, url: link.url });
  }
  preferences() {
  const view = (this.settings.view ?? {}) as Partial<ViewState>;
  const anchor = this.settings.anchor as Anchor | undefined;
  this.add('preferences', 'main', { theme: view.theme ?? 'system', calendarView: view.mode ?? 'week', showWeekends: view.showWeekends ?? true, startHour: view.startHour ?? 7, endHour: view.endHour ?? 20, ...(anchor ? { anchorDate: anchor.date, anchorWeek: anchor.week } : {}) });
  // Device state holds navigation/setup state, never account credentials or calendar content.
  this.add('device-preferences', 'main', { deviceId: this.deviceId, arrangement: view.arrangement ?? 'column', zoomPercent: Math.round((view.zoom ?? 1) * 100), batteryPromptShownAt: this.settings.batteryOptimizationPromptSeen ? new Date(0).toISOString() : null, viewState: { ...view, left: this.profileIds.get(view.left ?? 0) ?? null, right: this.profileIds.get(view.right ?? 0) ?? null, openProfiles: (view.openProfiles ?? []).map(id => this.profileIds.get(id)).filter(Boolean), setupProfileId: this.settings.setupProfileId ? this.profileIds.get(Number(this.settings.setupProfileId)) : null } });
  }
  palette() {
  const reminders: GlobalReminders = (this.settings.classReminders as GlobalReminders | undefined) ?? DEFAULT_REMINDERS;
  this.add('reminder-settings', 'main', { enabled: reminders.enabled });
  for (const rule of reminders.rules) this.add('reminder-rules', `global-${rule.minutes}`, { eventId: null, minutes: rule.minutes, profile: rule.profile });
  const paletteId = this.add('palettes', 'main', { name: 'Triton42 egyéni színek' });
  ((this.settings.savedColors as string[] | undefined) ?? []).forEach((color: string, position: number) => this.add('palette-colors', color, { presetId: paletteId, role: color, position, color }));
  }
  colors() {
  const colors: EventColors = (this.settings.eventColors as EventColors | undefined) ?? DEFAULT_EVENT_COLORS;
  const urgency = (rules: UrgencyRules | undefined) => rules ? { greenColor: rules.green, yellowColor: rules.yellow, redColor: rules.red, greenMinutes: rules.greenMinutes, yellowMinutes: rules.yellowMinutes, redMinutes: rules.redMinutes } : {};
  for (const role of ['lesson', 'deadline'] as const) this.add('color-rules', role, { scope: 'default', targetKey: role, ...urgency(colors[role]) });
  for (const [key, appearance] of Object.entries(colors.series)) {
    const [profile, category, title] = JSON.parse(key);
    const targetKey = JSON.stringify([this.profileIds.get(profile), category, title]);
    this.add('color-rules', `series-${key}`, { scope: 'series', targetKey, calendarId: this.calendars.get(profile), color: appearance.color ?? null, ...urgency(appearance.urgency) });
  }
  for (const [key, rules] of Object.entries(colors.occurrences)) {
    const eventId = this.eventIds.get(key);
    if (eventId) this.add('color-rules', `occurrence-${key}`, { scope: 'occurrence', targetKey: eventId, eventId, occurrenceKey: '', ...urgency(rules) });
  }
  }
}
export function eventFields(event: Occurrence): Record<string, unknown> {
  return { title: event.title, notes: event.notes ?? '', location: event.location ?? '', kind: event.kind,
    ...(event.kind === 'allDay' ? { startsAt: null, endsAt: null, startDate: wallTime(event.start).slice(0, 10), endDate: wallTime(event.end).slice(0, 10) } : { startsAt: new Date(event.start).toISOString(), endsAt: new Date(event.end > event.start ? event.end : event.start + 1).toISOString(), startDate: null, endDate: null }) };
}
