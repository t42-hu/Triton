import { stable, type CloudRecord } from './workspace-projection';
export type Baseline = CloudRecord & { version: number };
export type Mutation = { clientMutationId: string; resource: string; operation: 'create' | 'update' | 'delete'; id: string; version?: number; data?: Record<string, unknown> };
const uid = () => `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}-${Math.random().toString(36).slice(2)}`;
/** Only changed local records are uploaded; expected versions protect concurrent edits. */
export function mutationsFor(desired: CloudRecord[], baseline: Baseline[]): Mutation[] {
  const mutations: Mutation[] = [];
  for (const record of desired) {
    const old = baseline.find(row => row.resource === record.resource && row.id === record.id);
    if (!old || stable(old.data) !== stable(record.data)) mutations.push({ clientMutationId: uid(), resource: record.resource, operation: old ? 'update' : 'create', id: record.id, ...(old ? { version: old.version } : {}), data: old ? changedFields(record.data, old.data) : record.data });
  }
  for (const old of [...baseline].reverse()) if (!desired.some(row => row.id === old.id && row.resource === old.resource)) mutations.push({ clientMutationId: uid(), resource: old.resource, operation: 'delete', id: old.id, version: old.version });
  // Release the previous own-profile uniqueness constraint before selecting another.
  const ownOff = mutations.filter(row => row.resource === 'profiles' && row.operation === 'update' && row.data?.isOwn === false);
  const deletions = mutations.filter(row => row.operation === 'delete').sort((a, b) => deletionOrder(b.resource) - deletionOrder(a.resource));
  return [...ownOff, ...deletions, ...mutations.filter(row => row.operation !== 'delete' && !ownOff.includes(row))];
}

function changedFields(next: Record<string, unknown>, previous: Record<string, unknown>) { return Object.fromEntries(Object.entries(next).filter(([key, value]) => stable(value) !== stable(previous[key]))); }

const immutable: Record<string, string[]> = {
  'profile-calendars': ['profileId', 'calendarId'], sources: ['calendarId', 'format'], 'source-connections': ['sourceId'], events: ['calendarId', 'sourceId', 'externalUid'], overrides: ['eventId', 'occurrenceKey'], 'palette-colors': ['presetId', 'role'], 'color-rules': ['scope', 'targetKey', 'calendarId', 'eventId', 'occurrenceKey'], 'event-reminder-settings': ['eventId', 'occurrenceKey'], 'reminder-rules': ['eventId', 'occurrenceKey', 'minutes'], 'device-preferences': ['deviceId'],
};
/** Old rejected full-row updates cannot have receipts; rebuild those as valid partial updates. */
export function repairRejectedUpdates(pending: Mutation[], baseline: Baseline[]): Mutation[] {
  return pending.map(mutation => repairUpdate(mutation, baseline));
}
function repairUpdate(mutation: Mutation, baseline: Baseline[]): Mutation {
  const old = baseline.find(row => row.resource === mutation.resource && row.id === mutation.id);
  const invalid = mutation.operation === 'update' && old && immutable[mutation.resource]?.some(key => key in (mutation.data ?? {}));
  return invalid ? { ...mutation, clientMutationId: uid(), data: changedFields(mutation.data ?? {}, old.data) } : mutation;
}

function deletionOrder(resource: string) { return ['profiles', 'calendars', 'profile-calendars', 'sources', 'source-connections', 'events', 'overrides', 'event-reminder-settings', 'reminder-rules', 'tasks', 'notebook-links', 'preferences', 'device-preferences', 'palettes', 'palette-colors', 'color-rules', 'reminder-settings'].indexOf(resource); }
