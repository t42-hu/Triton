import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readSetting } from '../src/data/database';
import { saveProfile, deleteProfile } from '../src/data/repository';
import { requiredImportProfile } from '../src/data/required-setup';
import { stageSource, publishStages } from '../src/data/importer';

test('first profile requires an import across reloads; only a published import completes setup', async () => {
  assert.equal(await requiredImportProfile([]), null);
  const profileId = await saveProfile('First profile', undefined, true);
  assert.equal(await readSetting('setupProfileId', null), profileId);
  assert.equal(await requiredImportProfile([profileId]), profileId);
  const input = { id: `${profileId}:import`, profileId, format: 'json' as const, content: JSON.stringify({ version: 1, events: [{ id: 'lesson', title: 'Lesson', kind: 'timed', start: '2026-10-05T08:00:00+02:00', end: '2026-10-05T09:00:00+02:00', location: '' }] }), name: 'test', fromDate: '2026-10-01', toDate: '2026-10-31', isManual: 0 };
  const staged = await stageSource(input, { date: '2026-10-05', week: 'A' }, { signal: new AbortController().signal, progress: () => undefined });
  assert.equal(await requiredImportProfile([profileId]), profileId);
  await publishStages([staged]);
  assert.equal(await requiredImportProfile([profileId]), null);
  assert.equal(await readSetting('setupProfileId', null), null);
  await deleteProfile(profileId);
});

test('deleted setup profile does not leave an import pointing to a missing profile', async () => {
  const profileId = await saveProfile('Deleted first profile', undefined, true);
  await deleteProfile(profileId);
  assert.equal(await requiredImportProfile([]), null);
});
