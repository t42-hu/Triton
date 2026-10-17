import assert from 'node:assert/strict';
import test from 'node:test';
import { createWorkspaceSnapshotReader } from '../src/data/workspace-snapshot';

function server() {
  const paths: string[] = [];
  let pull = { requiresSnapshot: false, changes: [] as unknown[], nextSequence: '10', hasMore: false };
  let fail = false;
  const reader = createWorkspaceSnapshotReader(async <T>(path: string): Promise<T> => {
    paths.push(path);
    if (fail) throw new Error('offline');
    if (path.startsWith('/sync/pull')) return pull as T;
    if (path.startsWith('/sync/snapshot')) return { items: [{ resource: 'profiles', record: { id: 'profile', version: 1, name: 'Own' } }], snapshotToken: 'snapshot', highSequence: '10', nextOffset: null } as T;
    return {} as T;
  });
  return { reader, paths, setPull: (value: typeof pull) => { pull = value; }, fail: () => { fail = true; } };
}
test('unchanged workspaces use a single change check instead of downloading every snapshot page again', async () => {
  const api = server();
  const first = await api.reader('device');
  assert.equal(await api.reader('device'), first);
  assert.equal(api.paths.filter(path => path.startsWith('/sync/snapshot')).length, 1);
  assert.ok(api.paths.some(path => path.includes('/sync/pull?deviceId=device&after=10')));
});
test('changed records, incomplete change pages and revoked access require a fresh snapshot', async () => {
  for (const patch of [{ changes: [{}] }, { hasMore: true }, { requiresSnapshot: true }]) {
    const api = server();
    await api.reader('device');
    api.setPull({ requiresSnapshot: false, changes: [], nextSequence: '11', hasMore: false, ...patch });
    await api.reader('device');
    assert.equal(api.paths.filter(path => path.startsWith('/sync/snapshot')).length, 2);
  }
});
test('a different account device cannot reuse another device snapshot and network errors propagate', async () => {
  const api = server();
  await api.reader('first'); await api.reader('second');
  assert.equal(api.paths.filter(path => path.startsWith('/sync/snapshot')).length, 2);
  api.fail();
  await assert.rejects(api.reader('second'), /offline/);
});
