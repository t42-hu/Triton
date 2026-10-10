import assert from 'node:assert/strict';
import test from 'node:test';
import { projectWorkspace } from '../src/data/workspace-projection';
import { hydrateWorkspace } from '../src/data/workspace-hydration';
import type { IdentityMap, LocalWorkspace, RemoteRecord } from '../src/data/workspace-types';
import { CalendarResourceSchemas } from '../../../shared/src/calendar-api';
import { mutationsFor, reconcileDeletions } from '../src/data/workspace-mutations';
const empty = (): LocalWorkspace => ({ profiles: [], sources: [], events: [], overrides: [], source_sync: [], event_reminders: [], lesson_tasks: [], notebook_links: [], settings: [] });
function fixture(): LocalWorkspace {
  const local = empty();
  const base = { key: 'event-1', title: 'Óra', originalTitle: 'Óra', start: Date.parse('2026-10-08T10:00:00Z'), end: Date.parse('2026-10-08T11:00:00Z'), location: 'BA.F.04', notes: '', kind: 'timed' as const, category: 'lesson' as const };
  local.profiles.push({ id: 1, name: 'Saját', isOwn: 1 });
  local.sources.push({ id: '1:manual:test', profileId: 1, format: 'json', isManual: 1, content: '{"version":1,"events":[]}', name: 'Óra', fromDate: '2026-10-01', toDate: '2026-10-31', revision: 'local' });
  local.events.push({ ...base, sourceId: '1:manual:test', profileId: 1, revision: 'local', title: 'Átnevezett óra', notes: 'Jegyzet', base: JSON.stringify(base), hidden: 0, patch: null, searchText: '' });
  local.overrides.push({ sourceId: '1:manual:test', key: base.key, patch: JSON.stringify({ title: 'Átnevezett óra', notes: 'Jegyzet' }) });
  local.lesson_tasks.push({ id: 'task-1', sourceId: '1:manual:test', profileId: 1, eventKey: base.key, title: 'Feladat', completed: 1, eventTitle: 'Óra', due: base.start, searchText: '' });
  local.notebook_links.push({ id: 'link-1', profileId: 1, notebookKey: 'matematika', subject: 'Matematika', title: 'Jegyzet', url: 'https://example.com', searchText: '' });
  local.event_reminders.push({ sourceId: '1:manual:test', key: base.key, excludeGlobal: 1, rules: '[{"minutes":15,"profile":"gentle"}]' });
  local.settings.push({ key: 'savedColors', value: '["#ffcc00"]' }, { key: 'view', value: '{"theme":"dark","left":1,"openProfiles":[]}' });
  return local;
}
test('all projected records conform to existing backend schemas without schema changes', () => {
  const records = projectWorkspace(fixture(), {}, 'installation', 'device');
  for (const record of records) assert.equal(CalendarResourceSchemas[record.resource as keyof typeof CalendarResourceSchemas].safeParse({ id: record.id, ...record.data }).success, true, `${record.resource}: ${JSON.stringify(record.data)}`);
});
test('a new device restores profiles, overrides, tasks, links, colors and reminder rules', () => {
  const local = fixture(); const ids: IdentityMap = {};
  const records: RemoteRecord[] = projectWorkspace(local, ids, 'installation', 'device').map(row => ({ ...row, version: 1 }));
  const source = records.find(row => row.resource === 'sources')!; source.data.content = local.sources[0].content;
  const restored = hydrateWorkspace(records, empty(), {}, 'another-device');
  assert.equal(restored.profiles[0].name, 'Saját'); assert.equal(restored.sources[0].isManual, 1);
  assert.equal(restored.events[0].title, 'Átnevezett óra'); assert.equal(restored.events[0].notes, 'Jegyzet');
  assert.equal(restored.lesson_tasks[0].completed, 1); assert.equal(restored.notebook_links[0].subject, 'Matematika');
  assert.equal(restored.event_reminders[0].excludeGlobal, 1);
  assert.deepEqual(JSON.parse(restored.event_reminders[0].rules), [{ minutes: 15, profile: 'gentle' }]);
  assert.deepEqual(JSON.parse(restored.settings.find(row => row.key === 'savedColors')!.value), ['#ffcc00']);
});
test('stable IDs survive repeated projections and raw content is kept out of device view state', () => {
  const local = fixture(); const ids: IdentityMap = {};
  const first = projectWorkspace(local, ids, 'installation', 'device');
  assert.deepEqual(projectWorkspace(local, ids, 'installation', 'device'), first);
  assert.equal(JSON.stringify(first.find(row => row.resource === 'device-preferences')!.data).includes(local.sources[0].content), false);
});

test('a replayed upload still schedules newer offline edits with the acknowledged version', async () => {
  const { mutationsFor } = await import('../src/data/workspace-mutations');
  const saved = { resource: 'profiles', id: 'profile', data: { name: 'Régi', isOwn: true }, version: 4 };
  const newer = { resource: 'profiles', id: 'profile', data: { name: 'Új', isOwn: true } };
  const [update] = mutationsFor([newer], [saved]);
  assert.equal(update.operation, 'update'); assert.equal(update.version, 4); assert.equal(update.data?.name, 'Új');
  assert.deepEqual(mutationsFor([newer], [{ ...newer, version: 5 }]), []);
});
test('switching the own profile releases the previous owner before enabling the new one', async () => {
  const { mutationsFor } = await import('../src/data/workspace-mutations');
  const baseline = [{ resource: 'profiles', id: 'old', data: { name: 'Első', isOwn: true }, version: 1 }, { resource: 'profiles', id: 'new', data: { name: 'Második', isOwn: false }, version: 1 }];
  const desired = baseline.map(row => ({ ...row, data: { ...row.data, isOwn: row.id === 'new' } })).reverse();
  const mutations = mutationsFor(desired, baseline);
  assert.equal(mutations[0].id, 'old'); assert.equal(mutations[0].data?.isOwn, false); assert.equal(mutations[1].data?.isOwn, true);
});

test('updates omit unchanged immutable relationships and include only modified fields', async () => {
  const { mutationsFor } = await import('../src/data/workspace-mutations');
  const old = { resource: 'device-preferences', id: 'prefs', version: 2, data: { deviceId: 'device', arrangement: 'column', zoomPercent: 100 } };
  const [update] = mutationsFor([{ ...old, data: { ...old.data, zoomPercent: 125 } }], [old]);
  assert.deepEqual(update.data, { zoomPercent: 125 }); assert.equal(update.version, 2);
});

test('dependent records are deleted before their parents regardless of prior update order', async () => {
  const { mutationsFor } = await import('../src/data/workspace-mutations');
  const baseline = ['overrides', 'events', 'profile-calendars', 'profiles', 'calendars', 'sources'].map(resource => ({ resource, id: resource, data: {}, version: 1 }));
  const order = mutationsFor([], baseline).map(row => row.resource);
  assert.ok(order.indexOf('overrides') < order.indexOf('events'));
  assert.ok(order.indexOf('events') < order.indexOf('sources'));
  assert.ok(order.indexOf('profile-calendars') < order.indexOf('calendars'));
  assert.ok(order.indexOf('calendars') < order.indexOf('profiles'));
});

test('connection timestamps and remaining app settings round-trip through server records', () => {
  const local = fixture();
  local.source_sync.push({sourceId:local.sources[0].id,url:'https://example.test/calendar.ics',autoSync:1,importedAt:1000,lastAttempt:2000,lastSuccess:1500,lastError:'Retry',lastChange:'Updated'});
  local.settings.push({key:'changeNotifications',value:'true'},{key:'reminderStatus',value:'{"count":3}'},{key:'legacyDecision',value:'true'});
  const remote: RemoteRecord[] = projectWorkspace(local, {}, 'installation', 'device').map(row => ({...row,version:1}));
  const hydrated = hydrateWorkspace(remote, empty(), {}, 'device');
  const settings = Object.fromEntries(hydrated.settings.map(row => [row.key,JSON.parse(row.value)]));
  assert.equal(settings.changeNotifications,true);
  assert.deepEqual(settings.reminderStatus,{count:3});
  assert.equal(settings.legacyDecision,true);
  assert.equal(hydrated.source_sync[0].lastAttempt,2000);
  assert.equal(hydrated.source_sync[0].lastSuccess,1500);
  assert.equal(hydrated.source_sync[0].lastError,'Retry');
  assert.equal(hydrated.source_sync[0].lastChange,'Updated');
});

test('deleting a colored profile deletes its series rule instead of changing the immutable target', () => {
  const local = fixture(), ids: IdentityMap = {};
  local.profiles.push({ id: 2, name: 'Imported', isOwn: 0 });
  const colors = { series: { '[1,"lesson","Óra"]': { color: '#123456' }, '[2,"lesson","Fizika"]': { color: '#abcdef' } }, occurrences: {} };
  local.settings.push({ key: 'eventColors', value: JSON.stringify(colors) });
  const before = projectWorkspace(local, ids, 'installation', 'device').map(row => ({ ...row, version: 3 }));
  const removedRule = before.find(row => row.resource === 'color-rules' && row.data.color === '#abcdef')!;
  local.profiles = local.profiles.filter(profile => profile.id !== 2);
  const after = projectWorkspace(local, ids, 'installation', 'device');
  const mutations = mutationsFor(after, before);
  assert.deepEqual(mutations.filter(row => row.id === removedRule.id).map(row => row.operation), ['delete']);
  assert.ok(mutations.findIndex(row => row.id === removedRule.id) < mutations.findIndex(row => row.resource === 'calendars'));
  assert.ok(after.some(row => row.resource === 'color-rules' && row.data.color === '#123456'));
  for (const row of after) assert.ok(CalendarResourceSchemas[row.resource as keyof typeof CalendarResourceSchemas].safeParse({ id: row.id, ...row.data }).success);
});

test('deletion reconciles remote absence and newer versions without relaxing update conflicts', () => {
  const mutations = mutationsFor([], [
    { resource: 'profiles', id: 'gone', data: {}, version: 1 },
    { resource: 'profiles', id: 'renamed', data: {}, version: 1 },
    { resource: 'profiles', id: 'unchanged', data: {}, version: 1 },
    { resource: 'events', id: 'renamed', data: {}, version: 1 },
  ]);
  const update = { clientMutationId: 'edit', resource: 'profiles', id: 'renamed', operation: 'update' as const, version: 1, data: { name: 'Edit' } };
  const reconciled = reconcileDeletions([...mutations, update], [
    { resource: 'profiles', id: 'renamed', version: 4 },
    { resource: 'profiles', id: 'unchanged', version: 1 },
  ]);
  assert.equal(reconciled.length, 3);
  const deletion = reconciled.find(row => row.id === 'renamed' && row.operation === 'delete')!;
  assert.equal(deletion.version, 4);
  assert.notEqual(deletion.clientMutationId, mutations.find(row => row.resource === 'profiles' && row.id === 'renamed')!.clientMutationId);
  assert.equal(reconciled.find(row => row.id === 'unchanged')!.clientMutationId, mutations.find(row => row.id === 'unchanged')!.clientMutationId);
  assert.equal(reconciled.find(row => row.operation === 'update'), update);
});
