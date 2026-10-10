import type { RemoteRow } from './workspace-types';
import { Platform } from 'react-native';
import type { SQLiteDatabase } from 'expo-sqlite';
import { backend } from './backend';
import { completeAccountMigration, configureServerCommit, write } from './database';
import { hydrateWorkspace, type RemoteRecord } from './workspace-hydration';
import { projectWorkspace, stable, type CloudRecord, type IdentityMap, type LocalWorkspace } from './workspace-projection';
import { mutationsFor, reconcileDeletions, repairRejectedUpdates, type Baseline, type Mutation } from './workspace-mutations';
type State = { installation: string; deviceId: string; identities: IdentityMap; baseline: Baseline[]; pending: Mutation[]; sources: Record<string, string>; initialized: boolean };
const tables = ['profiles', 'sources', 'events', 'overrides', 'source_sync', 'event_reminders', 'lesson_tasks', 'notebook_links', 'settings'] as const;
let applying = false;
export function isCloudWrite() { return applying; }
const uid = () => `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}-${Math.random().toString(36).slice(2)}`;
export async function localWorkspace(db: SQLiteDatabase): Promise<LocalWorkspace> {
  const entries = await Promise.all(tables.map(async table => [table, await db.getAllAsync(table === 'events' ? 'SELECT e.* FROM events e JOIN sources s ON s.id=e.sourceId AND s.revision=e.revision' : `SELECT * FROM ${table}`)]));
  return Object.fromEntries(entries) as LocalWorkspace;
}
async function setting(db: SQLiteDatabase, key: string, value: unknown) { await db.runAsync('INSERT OR REPLACE INTO settings VALUES (?,?)', key, JSON.stringify(value)); }
async function state(db: SQLiteDatabase): Promise<State> {
  const row = await db.getFirstAsync<{ value: string }>("SELECT value FROM settings WHERE key='cloudSync'");
  if (row) return JSON.parse(row.value);
  const owner = await db.getFirstAsync<{ value: string }>("SELECT value FROM settings WHERE key='accountOwner'");
  return { installation: owner ? `account-${JSON.parse(owner.value)}-${Platform.OS}` : uid(), deviceId: '', identities: {}, baseline: [], pending: [], sources: {}, initialized: false };
}
async function snapshot(deviceId: string): Promise<RemoteRecord[]> {
  const records: RemoteRecord[] = [];
  let token: string | undefined; let offset = 0; let sequence = '0';
  do {
    const query = new URLSearchParams({ deviceId, limit: '200', ...(token ? { snapshotToken: token, offset: String(offset) } : {}) });
    const page = await backend<{ items: { resource: string; record: RemoteRow }[]; snapshotToken: string; highSequence: string; nextOffset: number | null }>(`/sync/snapshot?${query}`);
    token = page.snapshotToken; sequence = page.highSequence;
    records.push(...page.items.map(item => ({ resource: item.resource, id: item.record.id, version: item.record.version, data: item.record })));
    if (page.nextOffset === null) break;
    offset = page.nextOffset;
  } while (true);
  await backend('/sync/ack', 'POST', { deviceId, sequence, snapshotToken: token });
  return records;
}
async function sourceContents(remote: RemoteRecord[], local: LocalWorkspace, sync: State) {
  const calendars = new Set(remote.filter(row => row.resource === 'calendars' && row.data.ownerUserId).map(row => row.id));
  for (const source of remote.filter(row => row.resource === 'sources' && calendars.has(String(row.data.calendarId)))) {
    await sourceContent(source, local, sync);
  }
}
async function sourceContent(source: RemoteRecord, local: LocalWorkspace, sync: State) {
    const previousId = Object.keys(sync.identities).find(key => key.startsWith('sources:') && sync.identities[key] === source.id)?.slice(8);
    const previous = local.sources.find(row => row.id === previousId);
    if (previous && String(source.version) === previous.revision) { source.data.content = previous.content; return; }
    try { source.data.content = (await backend<{ content: string | null }>(`/calendar-files/sources/${source.id}/content`)).content; }
    catch (error) { if ((error as { status?: number }).status !== 403) throw error; }
}

async function replaceCache(db: SQLiteDatabase, local: LocalWorkspace) {
  await db.withTransactionAsync(() => insertCache(db, local));
}
async function insertCache(db: SQLiteDatabase, local: LocalWorkspace) {
    for (const table of [...tables].reverse()) if (table !== 'settings') await db.runAsync(`DELETE FROM ${table}`);
    for (const table of tables) {
      const allowed = new Set((await db.getAllAsync<{ name: string }>(`PRAGMA table_info(${table})`)).map(column => column.name));
      for (const row of local[table]) await insertCacheRow(db, table, row, allowed);
    }
}
async function insertCacheRow(db: SQLiteDatabase, table: string, row: object, allowed: Set<string>) {
  if (table === 'settings' && 'key' in row && row.key === 'cloudSync') return;
  const keys = Object.keys(row).filter(key => allowed.has(key));
  if (!keys.length) return;
  await db.runAsync(`INSERT OR REPLACE INTO ${table} (${keys.map(key => `"${key}"`).join(',')}) VALUES (${keys.map(() => '?').join(',')})`, ...keys.map(key => (row as Record<string, string | number | null>)[key] ?? null));
}

function baselineFrom(desired: CloudRecord[], remote: RemoteRecord[]): Baseline[] {
  const baseline: Baseline[] = [];
  for (const row of desired) {
    const server = remote.find(item => item.resource === row.resource && item.id === row.id);
    if (server) baseline.push({ ...row, data: Object.fromEntries(Object.keys(row.data).map(key => [key, server.data[key]])), version: server.version });
  }
  return baseline;
}
export async function synchronizeWorkspace(resolution?: 'local' | 'server'): Promise<void> {
  await write(async db => {
    applying = true;
    try { await new WorkspaceSynchronization(db, await state(db)).run(resolution); }
    finally { setTimeout(finishCloudWrite, 0); }
  }, false);
}
async function commitWorkspace(db: SQLiteDatabase) {
  if (!await unsyncedChanges(db)) return;
  applying = true;
  try { await new WorkspaceSynchronization(db, await state(db)).run(); await completeAccountMigration(); }
  finally { applying = false; }
}
configureServerCommit(commitWorkspace);
class WorkspaceSynchronization {
  local!: LocalWorkspace;
  remote: RemoteRecord[] = [];
  desired: CloudRecord[] = [];
  constructor(readonly db: SQLiteDatabase, readonly sync: State) {}
  async run(resolution?: 'local' | 'server') {
    await this.register();
    this.local = await localWorkspace(this.db);
    this.remote = await snapshot(this.sync.deviceId);
    if (!this.sync.initialized || resolution === 'server') await this.bootstrap(resolution);
    if (resolution === 'local') this.keepLocal();
    this.desired = projectWorkspace(this.local, this.sync.identities, this.sync.installation, this.sync.deviceId);
    this.validateSources();
    this.sync.pending = repairRejectedUpdates(this.sync.pending, this.sync.baseline);
    if (!this.sync.pending.length) this.sync.pending = mutationsFor(this.desired, this.sync.baseline);
    await this.persist(); await this.push();
    // Complete any pre-migration upload before committing the latest state.
    this.sync.pending = mutationsFor(this.desired, this.sync.baseline);
    await this.persist(); await this.push(); await this.restore();
    await completeAccountMigration();
  }
  persist() { return setting(this.db, 'cloudSync', this.sync); }
  async register() {
    if (this.sync.deviceId) return;
    const device = await backend<{ id: string }>('/sync/devices', 'POST', { installationId: this.sync.installation, platform: Platform.OS, name: `Triton42 ${Platform.OS}` });
    this.sync.deviceId = device.id; await this.persist();
  }
  async bootstrap(resolution?: 'local' | 'server') {
    if (resolution === 'server') await setting(this.db, 'cloudConflictBackup', this.local);
    await sourceContents(this.remote, this.local, this.sync);
    this.local = hydrateWorkspace(this.remote, this.local, this.sync.identities, this.sync.deviceId, !this.sync.initialized);
    await replaceCache(this.db, this.local);
    this.rememberSources(this.local);
    this.sync.baseline = baselineFrom(projectWorkspace(this.local, this.sync.identities, this.sync.installation, this.sync.deviceId), this.remote);
    this.sync.initialized = true; this.sync.pending = []; await this.persist();
  }
  rememberSources(local: LocalWorkspace) {
    for (const source of local.sources) {
      const remoteId = this.sync.identities[`sources:${source.id}`];
      if (this.remote.some(row => row.resource === 'sources' && row.id === remoteId)) this.sync.sources[source.id] = stable([source.content, source.fromDate, source.toDate]);
    }
  }
  keepLocal() {
    this.sync.pending = []; this.sync.sources = {};
    for (const row of this.sync.baseline) row.version = this.remote.find(item => item.id === row.id && item.resource === row.resource)?.version ?? row.version;
  }
  validateSources() {
    for (const source of this.local.sources) {
      const count = this.local.events.filter(event => event.sourceId === source.id).length;
      if (source.content.length > 1000000 || count > 5000) throw new Error(`A(z) ${source.name} forrás meghaladja a szerver importkorlátját (1 MB / 5000 alkalom). Válassz rövidebb időtartományt.`);
    }
  }
  async push() {
    this.sync.pending = reconcileDeletions(this.sync.pending, this.remote);
    const versions = new Map(this.sync.baseline.filter(row => row.resource === 'sources').map(row => [row.id, row.version]));
    const contents = this.local.sources.filter(source => this.sync.sources[source.id] !== stable([source.content, source.fromDate, source.toDate])).map(source => {
      const sourceId = this.sync.identities[`sources:${source.id}`];
      const version = versions.get(sourceId);
      return { sourceId, ...(version ? { version } : {}), content: source.content };
    });
    if (!this.sync.pending.length && !contents.length) return;
    const response = await backend<{ results: { clientMutationId: string; record: RemoteRow }[] }>('/sync/commit', 'POST', { deviceId: this.sync.deviceId, mutations: this.sync.pending, contents });
    const results = new Map(response.results.map(row => [row.clientMutationId, row.record]));
    for (const mutation of this.sync.pending) this.acceptMutation(mutation, results.get(mutation.clientMutationId));
    this.sync.pending = [];
    for (const source of this.local.sources) this.sync.sources[source.id] = stable([source.content, source.fromDate, source.toDate]);
    await this.persist();
  }
  acceptMutation(mutation: Mutation, result?: RemoteRow) {
    const old = this.sync.baseline.find(row => row.resource === mutation.resource && row.id === mutation.id);
    this.sync.baseline = this.sync.baseline.filter(row => row.resource !== mutation.resource || row.id !== mutation.id);
    if (mutation.operation !== 'delete' && result) this.sync.baseline.push({ resource: mutation.resource, id: mutation.id, data: { ...old?.data, ...mutation.data }, version: result.version });
  }
  async restore() {
    this.remote = await snapshot(this.sync.deviceId);
    await sourceContents(this.remote, this.local, this.sync);
    const restored = hydrateWorkspace(this.remote, this.local, this.sync.identities, this.sync.deviceId);
    await replaceCache(this.db, restored);
    this.rememberSources(restored);
    this.sync.baseline = baselineFrom(projectWorkspace(restored, this.sync.identities, this.sync.installation, this.sync.deviceId), this.remote);
    await this.persist();
  }
}
export async function hasUnsyncedChanges(): Promise<boolean> {
  const { getDatabase } = await import('./database');
  return unsyncedChanges(await getDatabase());
}
async function unsyncedChanges(db: SQLiteDatabase) {
  const sync = await state(db);
  if (!sync.initialized || sync.pending.length) return true;
  const local = await localWorkspace(db);
  const desired = projectWorkspace(local, sync.identities, sync.installation, sync.deviceId);
  return mutationsFor(desired, sync.baseline).length > 0 || local.sources.some(source => sync.sources[source.id] !== stable([source.content, source.fromDate, source.toDate]));
}

function finishCloudWrite() { applying = false; }
