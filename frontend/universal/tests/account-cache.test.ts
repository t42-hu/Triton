import assert from 'node:assert/strict';
import { test } from 'node:test';
import { backupDatabaseAsync, openDatabaseAsync } from './sqlite-adapter';
import { clearAccountMemory, eraseAccountDatabase, getDatabase, onDatabaseWrite, readSetting, saveSetting, selectAccountDatabase, transaction } from '../src/data/database';
import { deleteProfile, profiles, saveProfile } from '../src/data/repository';

test('offline edits and deletions survive closing and reopening the account file', async () => {
  await selectAccountDatabase('offline-restart');
  await saveSetting('fixture', 'saved-offline');
  const first = await saveProfile('Offline profile');
  const deleted = await saveProfile('Deleted offline');
  await deleteProfile(deleted);
  await clearAccountMemory();
  await selectAccountDatabase('offline-restart');
  assert.equal(await readSetting('fixture', ''), 'saved-offline');
  assert.deepEqual((await profiles()).map(row => row.id), [first]);
  await eraseAccountDatabase('offline-restart');
});

test('existing account files retain pending receipts, baselines and source fingerprints', async () => {
  await clearAccountMemory();
  await saveSetting('fixture', 'existing-account');
  const sync = { initialized: true, pending: [{ clientMutationId: 'durable-retry' }], sources: { source: 'fingerprint' } };
  await saveSetting('cloudSync', sync);
  const original = await openDatabaseAsync('account-existing.db');
  await backupDatabaseAsync({ sourceDatabase: await getDatabase() as never, destDatabase: original });
  await original.closeAsync();
  await selectAccountDatabase('existing');
  assert.equal(await readSetting('fixture', ''), 'existing-account');
  assert.deepEqual(await readSetting('cloudSync', null), sync);
  await clearAccountMemory();
  await selectAccountDatabase('existing');
  assert.deepEqual(await readSetting('cloudSync', null), sync);
  await eraseAccountDatabase('existing');
});

test('local SQL failures roll back atomically without losing earlier offline edits', async () => {
  await selectAccountDatabase('offline-rollback');
  await saveProfile('Keep');
  await assert.rejects(transaction(async db => {
    await db.runAsync('DELETE FROM profiles');
    throw new Error('Local failure');
  }), /Local failure/);
  await clearAccountMemory();
  await selectAccountDatabase('offline-rollback');
  assert.deepEqual((await profiles()).map(row => row.name), ['Keep']);
  await eraseAccountDatabase('offline-rollback');
});

test('only changed local commits notify the uploader, avoiding a sync/refresh loop', async () => {
  await selectAccountDatabase('offline-observers');
  let writes = 0;
  const unsubscribe = onDatabaseWrite(() => { writes++; });
  try {
    await saveSetting('view', { theme: 'dark' });
    await saveSetting('view', { theme: 'dark' });
    assert.equal(writes, 1);
  } finally { unsubscribe(); await eraseAccountDatabase('offline-observers'); }
});
