import assert from 'node:assert/strict';
import { test } from 'node:test';
import { backupDatabaseAsync, openDatabaseAsync } from './sqlite-adapter';
import { clearAccountMemory, completeAccountMigration, configureServerCommit, eraseAccountDatabase, getDatabase, onDatabasePreview, readSetting, saveSetting, selectAccountDatabase } from '../src/data/database';
import { deleteProfile, profiles, saveProfile } from '../src/data/repository';

test('server saves are awaited; failures roll back memory and no account data survives a local restart', async () => {
  await selectAccountDatabase('server-only');
  let saved: unknown;
  configureServerCommit(async db => { saved = (await db.getFirstAsync<{value:string}>('SELECT value FROM settings WHERE key=?', 'fixture'))?.value; });
  await saveSetting('fixture', 'confirmed');
  assert.equal(saved, JSON.stringify('confirmed'));
  configureServerCommit(async () => { throw new Error('Server unavailable'); });
  await assert.rejects(saveSetting('fixture', 'unconfirmed'), /Server unavailable/);
  assert.equal(await readSetting('fixture', ''), 'confirmed');
  await clearAccountMemory();
  configureServerCommit(async () => undefined);
  await selectAccountDatabase('server-only');
  assert.equal(await readSetting('fixture', ''), '');
  await eraseAccountDatabase('server-only');
});

test('a previous account file is retained until server acknowledgement, then removed without deleting unrelated legacy data', async () => {
  configureServerCommit(async () => undefined);
  await saveSetting('fixture', 'old-account');
  const original = await openDatabaseAsync('account-migrated.db');
  const unrelated = await openDatabaseAsync('account-unrelated.db');
  await backupDatabaseAsync({sourceDatabase: await getDatabase() as never, destDatabase: original});
  await unrelated.execAsync("CREATE TABLE fixture(value TEXT); INSERT INTO fixture VALUES ('untouched')");
  await selectAccountDatabase('migrated');
  assert.equal(await readSetting('fixture', ''), 'old-account');
  assert.equal((await original.getFirstAsync('SELECT value FROM settings WHERE key=?', 'fixture'))?.value, JSON.stringify('old-account'));
  await completeAccountMigration();
  const removed = await openDatabaseAsync('account-migrated.db');
  assert.equal(await removed.getFirstAsync("SELECT name FROM sqlite_master WHERE name='settings'"), null);
  assert.equal((await unrelated.getFirstAsync('SELECT value FROM fixture'))?.value, 'untouched');
});

test('deletions become readable before server acknowledgement and failed deletion restores the previous data', async () => {
  configureServerCommit(async () => undefined);
  await selectAccountDatabase('deletion-preview');
  const first = await saveProfile('Acknowledged'), second = await saveProfile('Rollback');
  let previews = 0;
  const unsubscribe = onDatabasePreview(() => { previews++; });
  try {
    for (const [id, failure] of [[first, false], [second, true]] as const) {
      let release!: () => void, reject!: (error: Error) => void, entered!: () => void;
      const started = new Promise<void>(resolve => { entered = resolve; });
      const gate = new Promise<void>((resolve, failure) => { release = resolve; reject = failure; });
      configureServerCommit(async () => { entered(); await gate; });
      let settled = false;
      const deletion = deleteProfile(id);
      void deletion.then(() => { settled = true; }, () => { settled = true; });
      await started;
      assert.equal(settled, false);
      assert.equal((await profiles()).some(profile => profile.id === id), false);
      if (failure) { reject(new Error('Rejected')); await assert.rejects(deletion, /Rejected/); }
      else { release(); await deletion; }
      assert.equal((await profiles()).some(profile => profile.id === id), failure);
    }
    assert.equal(previews, 3, 'two previews and one rollback');
    assert.deepEqual((await profiles()).map(profile => profile.name), ['Rollback']);
  } finally { unsubscribe(); configureServerCommit(async () => undefined); await eraseAccountDatabase('deletion-preview'); }
});
