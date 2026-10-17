import assert from 'node:assert/strict';
import test from 'node:test';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';
import ts from 'typescript';
import { openDatabaseAsync, backupDatabaseAsync } from './sqlite-adapter';
import { getDatabase } from '../src/data/database';
import * as projection from '../src/data/workspace-projection';
import * as hydration from '../src/data/workspace-hydration';
import * as mutations from '../src/data/workspace-mutations';
import * as snapshots from '../src/data/workspace-snapshot';

type Row = { id: string; version: number; [key: string]: any };
const failure = (status: number) => Object.assign(new Error(status === 0 ? 'Offline' : 'Conflict'), { status });
class Server {
  records = new Map<string, { resource: string; record: Row }>();
  contents = new Map<string, string>();
  receipts = new Map<string, Row>();
  commits: any[] = [];
  offline = false;
  snapshots = 0;
  loseResponse = false;
  async request(path: string, method = 'GET', body?: any): Promise<any> {
    if (this.offline) throw failure(0);
    if (path === '/sync/devices') {
      const id = body.installationId;
      this.records.set(`devices:${id}`, { resource: 'devices', record: { id, version: 1, platform: body.platform } });
      return { id };
    }
    if (path.startsWith('/sync/snapshot')) { this.snapshots++; return { items: [...this.records.values()], snapshotToken: 'snapshot', highSequence: '1', nextOffset: null }; }
    if (path.startsWith('/sync/pull')) return { requiresSnapshot: true, changes: [], nextSequence: '1', hasMore: false };
    if (path === '/sync/ack') return {};
    if (path.startsWith('/calendar-files/')) return { content: this.contents.get(path.split('/')[3]) ?? null };
    assert.equal(path, '/sync/commit'); assert.equal(method, 'POST');
    this.commits.push(structuredClone(body));
    const staged = structuredClone(this.records), receipts = structuredClone(this.receipts), contents = structuredClone(this.contents);
    const results = [];
    for (const mutation of body.mutations) {
      const receiptKey = `${body.deviceId}:${mutation.clientMutationId}`;
      const receipt = receipts.get(receiptKey);
      if (receipt) { results.push({ clientMutationId: mutation.clientMutationId, record: receipt }); continue; }
      const key = `${mutation.resource}:${mutation.id}`, old = staged.get(key)?.record;
      if (mutation.operation !== 'create' && old?.version !== mutation.version) throw failure(409);
      if (mutation.operation === 'create' && old) throw failure(409);
      const record = { ...old, ...mutation.data, id: mutation.id, version: (old?.version ?? 0) + 1, ...(mutation.resource === 'calendars' ? { ownerUserId: 'account' } : {}) };
      if (mutation.operation === 'delete') staged.delete(key);
      else staged.set(key, { resource: mutation.resource, record });
      receipts.set(receiptKey, record); results.push({ clientMutationId: mutation.clientMutationId, record });
    }
    for (const content of body.contents) {
      if (contents.get(content.sourceId) === content.content) continue;
      const source = staged.get(`sources:${content.sourceId}`)!;
      const mutation = body.mutations.find((row: any) => row.resource === 'sources' && row.id === content.sourceId);
      const result = results.find(row => row.clientMutationId === mutation?.clientMutationId);
      if (source.record.version !== (result?.record.version ?? content.version)) throw failure(409);
      source.record = { ...source.record, version: source.record.version + 1 }; contents.set(content.sourceId, content.content);
      if (result) { result.record = source.record; receipts.set(`${body.deviceId}:${mutation.clientMutationId}`, source.record); }
    }
    this.records = staged; this.receipts = receipts; this.contents = contents;
    if (this.loseResponse) { this.loseResponse = false; throw failure(0); }
    return { results };
  }
}
async function client(server: Server, name: string, platform: string, existing = false) {
  const db = await openDatabaseAsync(`${name}.db`);
  if (!existing) await backupDatabaseAsync({ sourceDatabase: await getDatabase() as never, destDatabase: db });
  const exports: Record<string, any> = {};
  const source = ts.transpileModule(readFileSync(new URL('../src/data/workspace-sync.ts', import.meta.url), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const modules: Record<string, any> = { 'react-native': { Platform: { OS: platform } }, './backend': { backend: server.request.bind(server) }, './database': { write: (operation: any) => operation(db), getDatabase: async () => db }, './workspace-hydration': hydration, './workspace-projection': projection, './workspace-mutations': mutations, './workspace-snapshot': snapshots };
  vm.runInNewContext(source, { exports, require: (id: string) => modules[id], URLSearchParams, setTimeout });
  return { db, sync: exports.synchronizeWorkspace as (resolution?: 'local' | 'server') => Promise<void> };
}
test('offline changes survive a real SQLite reopen and upload alongside changes from another platform', async () => {
  const server = new Server();
  let android = await client(server, 'offline-android', 'android');
  await Promise.all([android.sync(), android.sync()]);
  assert.equal(server.snapshots, 2, 'overlapping foreground and subscription syncs share one run');
  server.offline = true;
  await android.db.runAsync('INSERT INTO profiles VALUES (1,?,1)', 'Offline Android');
  await assert.rejects(android.sync(), { status: 0 });
  await android.db.closeAsync();
  android = await client(server, 'offline-android', 'android', true);
  assert.equal((await android.db.getFirstAsync('SELECT name FROM profiles'))?.name, 'Offline Android');
  server.offline = false;
  const ios = await client(server, 'offline-ios', 'ios'); await ios.sync();
  await ios.db.runAsync('INSERT INTO profiles VALUES (1,?,0)', 'Online iOS'); await ios.sync();
  await android.sync(); await ios.sync();
  for (const device of [android, ios]) assert.deepEqual((await device.db.getAllAsync('SELECT name FROM profiles ORDER BY name')).map(row => row.name), ['Offline Android', 'Online iOS']);
  const web = await client(server, 'offline-web', 'web'); await web.sync();
  assert.equal((await web.db.getAllAsync('SELECT * FROM profiles')).length, 2);
});
test('a lost upload response replays its original file before sending newer offline content', async () => {
  const server = new Server(); let device = await client(server, 'lost-response', 'android'); await device.sync();
  await device.db.runAsync('INSERT INTO profiles VALUES (1,?,1)', 'Own');
  await device.db.runAsync('INSERT INTO sources VALUES (?,?,?,?,?,?,?,?,?)', 'source', 1, 'json', 'original', 'File', 'local', '2026-01-01', '2026-12-31', 0);
  server.loseResponse = true; await assert.rejects(device.sync(), { status: 0 });
  const original = server.commits.at(-1);
  await device.db.runAsync('UPDATE sources SET content=? WHERE id=?', 'newer-offline', 'source');
  await device.db.closeAsync(); device = await client(server, 'lost-response', 'android', true);
  await device.sync();
  assert.deepEqual(server.commits.at(-2), original, 'retry retains mutation IDs and frozen raw content');
  assert.equal(server.commits.at(-1).contents[0].content, 'newer-offline');
  assert.equal((await device.db.getFirstAsync('SELECT content FROM sources'))?.content, 'newer-offline');
});
test('conflicting edits remain local after failure and restart until explicitly resolved', async () => {
  const server = new Server(); let device = await client(server, 'offline-conflict', 'ios'); await device.sync();
  await device.db.runAsync('INSERT INTO profiles VALUES (1,?,1)', 'Original'); await device.sync();
  const profile = [...server.records.values()].find(row => row.resource === 'profiles')!;
  profile.record = { ...profile.record, name: 'Changed elsewhere', version: profile.record.version + 1 };
  await device.db.runAsync('UPDATE profiles SET name=?', 'Local offline edit');
  await assert.rejects(device.sync(), { status: 409 });
  await device.db.closeAsync(); device = await client(server, 'offline-conflict', 'ios', true);
  assert.equal((await device.db.getFirstAsync('SELECT name FROM profiles'))?.name, 'Local offline edit');
  await device.sync('server');
  assert.equal((await device.db.getFirstAsync('SELECT name FROM profiles'))?.name, 'Changed elsewhere');
  assert.ok(await device.db.getFirstAsync("SELECT value FROM settings WHERE key='cloudConflictBackup'"));
});

test('an offline deletion survives restart and propagates without resurrecting on another platform', async () => {
  const server = new Server(); let android = await client(server, 'offline-delete', 'android'); await android.sync();
  await android.db.runAsync('INSERT INTO profiles VALUES (1,?,1)', 'Delete offline'); await android.sync();
  const web = await client(server, 'offline-delete-web', 'web'); await web.sync();
  server.offline = true;
  await android.db.runAsync('DELETE FROM profiles'); await assert.rejects(android.sync(), { status: 0 });
  await android.db.closeAsync(); android = await client(server, 'offline-delete', 'android', true);
  assert.equal((await android.db.getAllAsync('SELECT * FROM profiles')).length, 0);
  server.offline = false; await android.sync(); await web.sync();
  assert.equal((await web.db.getAllAsync('SELECT * FROM profiles')).length, 0);
});
