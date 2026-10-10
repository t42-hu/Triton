import { DEFAULT_EVENT_COLORS, type EventColors, type UrgencyRules } from '@/domain/event-colors';
import { fromWall } from '@/domain/time';
import { searchableText } from '@/domain/student';
import { type IdentityMap, type LocalWorkspace } from './workspace-projection';
import type { EventPatch } from '@/domain/model';
import type { RemoteRow as Row, RemoteRecord } from './workspace-types';
export type { RemoteRecord } from './workspace-types';
/** Converts normalized server records to the existing local cache without changing its schema. */
export function hydrateWorkspace(remote: RemoteRecord[], previous: LocalWorkspace, ids: IdentityMap, deviceId: string, merge = false): LocalWorkspace {
  const hydration = new WorkspaceHydration(remote, previous, ids, deviceId);
  hydration.profiles(); hydration.calendars(); hydration.sources(); hydration.tasks(); hydration.notebooks();
  hydration.preferences(); hydration.reminders(); hydration.palette(); hydration.colors();
  if (merge) hydration.merge();
  return hydration.next;
}
class WorkspaceHydration {
  readonly next: LocalWorkspace;
  profileCounter: number;
  readonly profileIds = new Map<string, number>();
  readonly calendarProfiles = new Map<string, number>();
  readonly eventKeys = new Map<string, { sourceId: string; key: string; profileId: number }>();
  constructor(readonly remote: RemoteRecord[], readonly previous: LocalWorkspace, readonly ids: IdentityMap, readonly deviceId: string) {
    this.next = { profiles: [], sources: [], events: [], overrides: [], source_sync: [], event_reminders: [], lesson_tasks: [], notebook_links: [], settings: [...previous.settings] };
    this.profileCounter = Math.max(0, ...previous.profiles.map(row => row.id));
  }
  rows(resource: string): Row[] { return this.remote.filter(row => row.resource === resource).map(row => ({ ...row.data, id: row.id, version: row.version }) as Row); }
  inverse(resource: string, remoteId: string) { return Object.keys(this.ids).find(key => key.startsWith(`${resource}:`) && this.ids[key] === remoteId)?.slice(resource.length + 1); }
  bind(resource: string, key: string, remoteId: string) { this.ids[`${resource}:${key}`] = remoteId; }
  set(key: string, value: unknown) { this.next.settings = this.next.settings.filter(row => row.key !== key); this.next.settings.push({ key, value: JSON.stringify(value) }); }
  profiles() {
    const { next, profileIds } = this;
    const rows = this.rows.bind(this);
    const inverse = this.inverse.bind(this);
    const bind = this.bind.bind(this);
  for (const profile of rows('profiles')) {
    const id = Number(inverse('profiles', profile.id)) || ++this.profileCounter;
    bind('profiles', String(id), profile.id); profileIds.set(profile.id, id);
    next.profiles.push({ id, name: profile.name, isOwn: Number(profile.isOwn) });
  }

  }
  calendars() {
    const { profileIds, calendarProfiles } = this;
    const rows = this.rows.bind(this);
    const bind = this.bind.bind(this);
  for (const link of rows('profile-calendars')) {
    const profileId = profileIds.get(link.profileId);
    if (profileId !== undefined) { calendarProfiles.set(link.calendarId, profileId); bind('calendars', String(profileId), link.calendarId); bind('profile-calendars', String(profileId), link.id); }
  }

  }
  sources() { for (const source of this.rows('sources')) this.source(source); }
  source(source: Row) {
    const { next, previous, calendarProfiles } = this;
    const rows = this.rows.bind(this), inverse = this.inverse.bind(this), bind = this.bind.bind(this);
    const profileId = calendarProfiles.get(source.calendarId);
    if (profileId === undefined) return;
    const id = inverse('sources', source.id) ?? source.id;
    bind('sources', id, source.id);
    const previousSource = previous.sources.find(row => row.id === id);
    const content = source.content ?? previousSource?.content ?? JSON.stringify({ version: 1, events: [] });
    next.sources.push({ id, profileId, format: source.format === 'manual' ? 'json' : source.format, content, name: source.name, revision: String(source.version), fromDate: source.coverageFrom ?? '2000-01-01', toDate: source.coverageTo ?? '2100-01-01', isManual: Number(source.format === 'manual') });
    const connection = rows('source-connections').find(row => row.sourceId === source.id);
    if (connection) {
      bind('source-connections', id, connection.id);
      next.source_sync.push({ sourceId: id, url: connection.url, autoSync: Number(connection.autoSync), importedAt: Date.parse(String(connection.importedAt)) || (previousSource ? previous.source_sync.find(row => row.sourceId === id)?.importedAt ?? Date.now() : Date.now()), lastAttempt: Date.parse(String(connection.lastAttemptAt)) || 0, lastSuccess: Date.parse(String(connection.lastSuccessAt)) || 0, lastError: String(connection.lastError ?? ''), lastChange: String(connection.lastChange ?? '') });
    }
    for (const event of rows('events').filter(row => row.sourceId === source.id)) this.event(source, id, profileId, event);
  }
  event(source: Row, id: string, profileId: number, event: Row) {
    const { next, previous, eventKeys } = this;
    const rows = this.rows.bind(this), bind = this.bind.bind(this);

      const key = event.externalUid ?? event.id;
      bind('events', JSON.stringify([id, key]), event.id);
      eventKeys.set(event.id, { sourceId: id, key, profileId });
      const old = previous.events.find(row => row.sourceId === id && row.key === key);
      const base = { key, title: event.title, originalTitle: old ? JSON.parse(old.base).originalTitle : event.title, start: event.kind === 'allDay' ? fromWall(event.startDate) : Date.parse(event.startsAt), end: event.kind === 'allDay' ? fromWall(event.endDate) : Date.parse(event.endsAt), location: event.location ?? '', notes: event.notes ?? '', kind: event.kind, category: event.category };
      const override = rows('overrides').find(row => row.eventId === event.id && !row.occurrenceKey);
      const patch: EventPatch = override ? { title: override.title ?? base.title, location: override.location ?? base.location, notes: override.notes ?? base.notes, start: event.kind === 'allDay' ? override.startDate ? fromWall(override.startDate) : base.start : override.startsAt ? Date.parse(override.startsAt) : base.start, end: event.kind === 'allDay' ? override.endDate ? fromWall(override.endDate) : base.end : override.endsAt ? Date.parse(override.endsAt) : base.end, hidden: override.hidden, category: event.category } : {};
      if (override) { bind('overrides', JSON.stringify([id, key]), override.id); next.overrides.push({ sourceId: id, key, patch: JSON.stringify(patch) }); }
      const effective = { ...base, ...patch };
      next.events.push({ profileId, patch: override ? JSON.stringify(patch) : null, sourceId: id, revision: String(source.version), ...effective, hidden: Number(effective.hidden ?? false), base: JSON.stringify(base), searchText: searchableText(`${effective.title} ${effective.location} ${effective.notes}`) });

      this.eventReminders(id, key, event.id);

  }
  eventReminders(id: string, key: string, eventId: string) {
    const { next } = this;
    const rows = this.rows.bind(this), bind = this.bind.bind(this);
      const reminders = rows('event-reminder-settings').find(row => row.eventId === eventId && !row.occurrenceKey);
      if (reminders) {
        bind('event-reminder-settings', JSON.stringify([id, key]), reminders.id);
        const rules = rows('reminder-rules').filter(row => row.eventId === eventId && !row.occurrenceKey).map(rule => { bind('reminder-rules', JSON.stringify([id, key, rule.minutes]), rule.id); return { minutes: rule.minutes, profile: rule.profile }; });
        next.event_reminders.push({ sourceId: id, key, excludeGlobal: Number(reminders.excludeGlobal), rules: JSON.stringify(rules) });
      }
    
  }
  tasks() {
    const { next, eventKeys } = this;
    const rows = this.rows.bind(this);
    const inverse = this.inverse.bind(this);
    const bind = this.bind.bind(this);
  for (const task of rows('tasks')) {
    const event = eventKeys.get(task.eventId);
    // Current task UI attaches tasks to an occurrence; standalone remote tasks stay on the server.
    if (!event) continue;
    const id = inverse('tasks', task.id) ?? task.id; bind('tasks', id, task.id);
    next.lesson_tasks.push({ id, profileId: event.profileId, sourceId: event.sourceId, eventKey: event.key, title: task.title, completed: Number(task.completed), eventTitle: task.eventTitle ?? '', due: Date.parse(task.dueAt), searchText: searchableText(`${task.title} ${task.eventTitle ?? ''}`) });
  }

  }
  notebooks() {
    const { next, profileIds } = this;
    const rows = this.rows.bind(this);
    const inverse = this.inverse.bind(this);
    const bind = this.bind.bind(this);
  for (const link of rows('notebook-links')) {
    const profileId = profileIds.get(link.profileId); if (profileId === undefined) continue;
    const id = inverse('notebook-links', link.id) ?? link.id; bind('notebook-links', id, link.id);
    next.notebook_links.push({ id, profileId, notebookKey: link.subjectKey ?? '', subject: link.subject ?? '', title: link.title, url: link.url ?? '', searchText: searchableText(`${link.subject ?? ''} ${link.title} ${link.url}`) });
  }

  }
  preferences() {
    const { previous, deviceId, profileIds } = this;
    const rows = this.rows.bind(this);
    const bind = this.bind.bind(this);
    const set = this.set.bind(this);
  const oldSettings = Object.fromEntries(previous.settings.map(row => [row.key, JSON.parse(row.value)]));
  const preferences = rows('preferences')[0];
  const platform = rows('devices').find(row => row.id === deviceId)?.platform;
  const devices = new Set(rows('devices').filter(row => row.platform === platform).map(row => row.id));
  const device = rows('device-preferences').find(row => row.deviceId === deviceId) ?? rows('device-preferences').filter(row => devices.has(row.deviceId)).sort((a, b) => Date.parse(String(b.updatedAt)) - Date.parse(String(a.updatedAt)))[0];
  const extras = device?.viewState?.accountSettings;
  const entries = extras && typeof extras === 'object' && !Array.isArray(extras) ? Object.entries(extras).filter(([key]) => !/^(cloud|accountOwner)/.test(key)) : [];
  for (const [key, value] of entries) set(key, value);
  const view = { ...(oldSettings.view ?? {}), ...(device?.viewState ?? {}) };
  if (preferences) {
    bind('preferences', 'main', preferences.id);
    Object.assign(view, { theme: preferences.theme, mode: preferences.calendarView, showWeekends: preferences.showWeekends, startHour: preferences.startHour, endHour: preferences.endHour });
    if (preferences.anchorDate) set('anchor', { date: preferences.anchorDate, week: preferences.anchorWeek });
  }
  if (device) { if (device.deviceId === deviceId) bind('device-preferences', 'main', device.id); set('setupProfileId', profileIds.get(String(device.viewState?.setupProfileId ?? '')) ?? null); if (device.batteryPromptShownAt) set('batteryOptimizationPromptSeen', true); }
  if (device) Object.assign(view, { left: profileIds.get(String(device.viewState.left)) ?? 0, right: profileIds.get(String(device.viewState.right)) ?? 0, openProfiles: Array.isArray(device.viewState.openProfiles) ? device.viewState.openProfiles.map(id => profileIds.get(String(id))).filter(id => id !== undefined) : [] });
  delete view.setupProfileId; delete view.accountSettings; set('view', view);

  }
  reminders() {
    const rows = this.rows.bind(this);
    const bind = this.bind.bind(this);
    const set = this.set.bind(this);
  const reminder = rows('reminder-settings')[0];
  if (reminder) {
    bind('reminder-settings', 'main', reminder.id);
    const rules = rows('reminder-rules').filter(row => !row.eventId).map(rule => { bind('reminder-rules', `global-${rule.minutes}`, rule.id); return { minutes: rule.minutes, profile: rule.profile }; });
    set('classReminders', { enabled: reminder.enabled, rules });
  }

  }
  palette() {
    const rows = this.rows.bind(this);
    const bind = this.bind.bind(this);
    const set = this.set.bind(this);
  const palette = rows('palettes').find(row => row.name === 'Triton42 egyéni színek');
  if (palette) {
    bind('palettes', 'main', palette.id);
    set('savedColors', rows('palette-colors').filter(row => row.presetId === palette.id).sort((a, b) => a.position - b.position).map(color => { bind('palette-colors', color.color, color.id); return color.color; }));
  }

  }
  colors() {
    const colors: EventColors = { ...DEFAULT_EVENT_COLORS, series: {}, occurrences: {} };
    for (const rule of this.rows('color-rules')) this.colorRule(rule, colors);
    if (this.rows('color-rules').length) this.set('eventColors', colors);
  }
  colorRule(rule: Row, colors: EventColors) {
    const rules: UrgencyRules | undefined = rule.yellowColor && rule.redColor ? { green: rule.greenColor, yellow: rule.yellowColor, red: rule.redColor, greenMinutes: rule.greenMinutes, yellowMinutes: rule.yellowMinutes, redMinutes: rule.redMinutes } : undefined;
    if (rule.scope === 'default' && (rule.targetKey === 'lesson' || rule.targetKey === 'deadline') && rules) { this.bind('color-rules', rule.targetKey, rule.id); colors[rule.targetKey] = rules; }
    if (rule.scope === 'series') this.seriesColor(rule, colors, rules);
    const event = this.eventKeys.get(rule.eventId);
    if (rule.scope === 'occurrence' && event && rules) { const key = JSON.stringify([event.sourceId, event.key]); this.bind('color-rules', `occurrence-${key}`, rule.id); colors.occurrences[key] = rules; }
  }
  seriesColor(rule: Row, colors: EventColors, rules?: UrgencyRules) {
    try {
      const [profile, category, title] = JSON.parse(rule.targetKey);
      const localId = this.profileIds.get(profile);
      if (localId === undefined) return;
      const key = JSON.stringify([localId, category, title]);
      this.bind('color-rules', `series-${key}`, rule.id);
      colors.series[key] = { ...(rule.color ? { color: rule.color } : {}), ...(rules ? { urgency: rules } : {}) };
    } catch { /* Other clients may use a different series key. */ }
  }
  merge() {
    const { next, previous } = this;
    const own = next.profiles.some(row => row.isOwn);
    for (const table of ['profiles', 'sources', 'events', 'overrides', 'source_sync', 'event_reminders', 'lesson_tasks', 'notebook_links'] as const) {
      const identity = (row: { id?: string | number; sourceId?: string; key?: string }) => table === 'events' || table === 'overrides' || table === 'event_reminders' ? JSON.stringify([row.sourceId, row.key]) : table === 'source_sync' ? row.sourceId : row.id;
      const existing = new Set(next[table].map(identity));
      (next[table] as unknown[]).push(...previous[table].filter(row => !existing.has(identity(row))).map(row => table === 'profiles' && own ? { ...row, isOwn: 0 } : row));
    }
  
  }
}
