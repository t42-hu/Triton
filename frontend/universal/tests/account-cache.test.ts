import assert from 'node:assert/strict';
import { test } from 'node:test';
import { eraseAccountDatabase, readSetting, saveSetting, selectAccountDatabase } from '../src/data/database';

test('account deletion erases only that account cache, preserving other accounts and anonymous data', async () => {
  await saveSetting('fixture', 'anonymous');
  await selectAccountDatabase('surviving-account'); await saveSetting('fixture', 'survivor');
  await selectAccountDatabase('deleted-account'); await saveSetting('fixture', 'deleted');
  await eraseAccountDatabase('deleted-account');
  assert.equal(await readSetting('fixture', ''), 'anonymous');
  await selectAccountDatabase('surviving-account'); assert.equal(await readSetting('fixture', ''), 'survivor');
  await selectAccountDatabase('deleted-account'); assert.equal(await readSetting('fixture', ''), '');
});
