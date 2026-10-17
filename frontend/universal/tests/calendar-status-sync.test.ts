import assert from 'node:assert/strict';
import test from 'node:test';
import { projectWorkspace } from '../src/data/workspace-projection';
import { mutationsFor, repairRejectedUpdates, type Mutation } from '../src/data/workspace-mutations';
import type { LocalWorkspace } from '../src/data/workspace-types';

function workspace(): LocalWorkspace {
  return {
    profiles: [{ id: 1, name: 'Own', isOwn: 1 }],
    sources: [{ id: 'feed', profileId: 1, format: 'ics', isManual: 0, content: '', name: 'Feed', fromDate: '2026-10-01', toDate: '2027-10-01', revision: '1' }],
    source_sync: [{ sourceId: 'feed', url: 'https://example.test/calendar.ics', autoSync: 1, importedAt: 1000, lastAttempt: 2000, lastSuccess: 1500, lastError: 'Old network error', lastChange: 'Updated' }],
    events: [], overrides: [], event_reminders: [], lesson_tasks: [], notebook_links: [], settings: [],
  };
}

test('client connection writes contain configuration while refresh status remains server-owned', () => {
  const connection = projectWorkspace(workspace(), {}, 'installation', 'device').find(row => row.resource === 'source-connections')!;
  assert.deepEqual(Object.keys(connection.data).sort(), ['autoSync', 'importedAt', 'sourceId', 'url']);
});

test('startup repairs a persisted stale lastError upload without recreating an empty update', () => {
  const desired = projectWorkspace(workspace(), {}, 'installation', 'device');
  const connection = desired.find(row => row.resource === 'source-connections')!;
  const baseline = desired.map(row => ({ ...row, version: 225, data: row === connection ? { ...row.data, lastError: '', lastAttemptAt: null, lastSuccessAt: null, lastChange: '' } : row.data }));
  const pending: Mutation[] = [{ clientMutationId: 'stale-status', resource: connection.resource, id: connection.id, operation: 'update', version: 225, data: { lastError: 'Old network error' } }];
  assert.deepEqual(repairRejectedUpdates(pending, baseline), []);
  assert.deepEqual(mutationsFor(desired, baseline), []);
});

test('repair preserves connection edits, deletes and other mutations with their version protection', () => {
  const edit: Mutation = { clientMutationId: 'edit', resource: 'source-connections', id: 'connection', operation: 'update', version: 225, data: { lastError: '', lastAttemptAt: null, autoSync: false, url: 'https://example.test/new.ics' } };
  const deletion: Mutation = { clientMutationId: 'delete', resource: 'source-connections', id: 'other', operation: 'delete', version: 2 };
  const rename: Mutation = { clientMutationId: 'rename', resource: 'profiles', id: 'profile', operation: 'update', version: 3, data: { name: 'Renamed' } };
  const [repaired, keptDeletion, keptRename] = repairRejectedUpdates([edit, deletion, rename], []);
  assert.deepEqual(repaired.data, { autoSync: false, url: 'https://example.test/new.ics' });
  assert.equal(repaired.version, 225);
  assert.notEqual(repaired.clientMutationId, edit.clientMutationId);
  assert.equal(keptDeletion, deletion);
  assert.equal(keptRename, rename);
});

test('already applied updates and unrelated remote edits do not leave stale retries while real conflicts remain', async () => {
  const { reconcileUpdates } = await import('../src/data/workspace-mutations');
  const old = { resource: 'preferences', id: 'p', version: 17, data: { calendarView: 'day', theme: 'light' } };
  const mutation: Mutation = { clientMutationId: 'retry', resource: 'preferences', id: 'p', version: 17, operation: 'update', data: { calendarView: 'week' } };
  const baseline = [structuredClone(old)];
  assert.deepEqual(reconcileUpdates([mutation], baseline, [{ ...old, version: 19, data: { calendarView: 'week', theme: 'dark' } }]), []);
  assert.equal(baseline[0].version, 19);
  assert.equal(baseline[0].data.theme, 'light', 'unrelated remote values are merged during hydration');
  assert.deepEqual(mutationsFor([{ resource: old.resource, id: old.id, data: { calendarView: 'week', theme: 'light' } }], baseline), []);
  const rebased = reconcileUpdates([mutation], [structuredClone(old)], [{ ...old, version: 19, data: { calendarView: 'day', theme: 'dark' } }]);
  assert.equal(rebased[0].version, 19);
  const conflicting = { ...mutation, data: { theme: 'system' } };
  assert.equal(reconcileUpdates([conflicting], [structuredClone(old)], [{ ...old, version: 19, data: { calendarView: 'day', theme: 'dark' } }])[0], conflicting);
});
