import { stable, type CloudRecord } from './workspace-projection';
export type Baseline = CloudRecord & { version: number };
export type Mutation = { clientMutationId: string; resource: string; operation: 'create' | 'update' | 'delete'; id: string; version?: number; data?: Record<string, unknown> };
/** A deletion is already complete if the latest accessible snapshot no longer contains it. */
export function reconcileDeletions(mutations: Mutation[], remote: { resource: string; id: string; version: number }[]): Mutation[] {
  const result: Mutation[] = [];
  for (const mutation of mutations) {
    if (mutation.operation !== 'delete') { result.push(mutation); continue; }
    const current = remote.find(row => row.resource === mutation.resource && row.id === mutation.id);
    if (current) result.push({ ...mutation, ...(current.version !== mutation.version ? { version: current.version, clientMutationId: uid() } : {}) });
  }
  return result;
}
const uid = () => `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}-${Math.random().toString(36).slice(2)}`;
/** Only changed local records are uploaded; expected versions protect concurrent edits. */
export function mutationsFor(desired: CloudRecord[], baseline: Baseline[]): Mutation[] {
  const mutations: Mutation[] = [];
  for (const record of desired) {
    const old = baseline.find(row => row.resource === record.resource && row.id === record.id);
    const data = old ? changedFields(record.data, old.data) : record.data;
    if (!old || Object.keys(data).length) mutations.push({ clientMutationId: uid(), resource: record.resource, operation: old ? 'update' : 'create', id: record.id, ...(old ? { version: old.version } : {}), data });
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
  return pending.map(mutation => repairUpdate(mutation, baseline)).flatMap(stripServerConnectionStatus);
}
const serverConnectionFields = new Set(['lastAttemptAt', 'lastSuccessAt', 'lastError', 'lastChange']);
/** Discard obsolete status-only uploads while retaining user configuration and optimistic versions. */
function stripServerConnectionStatus(mutation: Mutation): Mutation[] {
  if (mutation.resource !== 'source-connections' || mutation.operation === 'delete') return [mutation];
  const data = Object.fromEntries(Object.entries(mutation.data ?? {}).filter(([key]) => !serverConnectionFields.has(key)));
  if (mutation.operation === 'update' && !Object.keys(data).length) return [];
  return [stable(data) === stable(mutation.data) ? mutation : { ...mutation, clientMutationId: uid(), data }];
}
function repairUpdate(mutation: Mutation, baseline: Baseline[]): Mutation {
  const old = baseline.find(row => row.resource === mutation.resource && row.id === mutation.id);
  const invalid = mutation.operation === 'update' && old && immutable[mutation.resource]?.some(key => key in (mutation.data ?? {}));
  return invalid ? { ...mutation, clientMutationId: uid(), data: changedFields(mutation.data ?? {}, old.data) } : mutation;
}

function deletionOrder(resource: string) { return ['profiles', 'calendars', 'profile-calendars', 'sources', 'source-connections', 'events', 'overrides', 'event-reminder-settings', 'reminder-rules', 'tasks', 'notebook-links', 'preferences', 'device-preferences', 'palettes', 'palette-colors', 'color-rules', 'reminder-settings'].indexOf(resource); }

/** A retry may already be present remotely; unrelated remote edits can be rebased without overwriting them. */
export function reconcileUpdates(pending: Mutation[], baseline: Baseline[], remote: Baseline[]): Mutation[] {
  return pending.flatMap(mutation => reconcileUpdate(mutation, baseline, remote));
}
function reconcileUpdate(mutation: Mutation, baseline: Baseline[], remote: Baseline[]): Mutation[] {
    if (mutation.operation !== 'update') return [mutation];
    const current = remote.find(row => row.resource === mutation.resource && row.id === mutation.id);
    const old = baseline.find(row => row.resource === mutation.resource && row.id === mutation.id);
    if (!current || !old || current.version === mutation.version) return [mutation];
    const entries = Object.entries(mutation.data ?? {});
    if (entries.every(([key, value]) => stable(current.data[key]) === stable(value))) {
      Object.assign(old.data, mutation.data); old.version = current.version;
      return [];
    }
    if (entries.every(([key]) => stable(current.data[key]) === stable(old.data[key]))) {
      old.version = current.version;
      return [{ ...mutation, version: current.version, clientMutationId: uid() }];
    }
    return [mutation];
}
