import assert from 'node:assert/strict';
import { test } from 'node:test';
import { seedStarterProfiles } from '../src/data/starter-profiles';
import { profiles, sources, visibleEvents, deleteProfile } from '../src/data/repository';

test('supplied calendars appear once on startup and stay deleted when removed', async () => {
  await Promise.all([seedStarterProfiles(), seedStarterProfiles()]);
  const installed = await profiles();
  assert.deepEqual(installed.map(profile => profile.name), ['Me', 'Beni', 'Matyi', 'Parker']);
  assert.equal(installed.find(profile => profile.name === 'Me')?.isOwn, 1);
  assert.equal((await sources()).length, 4);
  for (const profile of installed) {
    assert.ok((await visibleEvents(profile.id, '2026-09-01', 110, false)).length >= 133);
  }
  await seedStarterProfiles();
  assert.equal((await sources()).length, 4);
  const parker = installed.find(profile => profile.name === 'Parker');
  assert.ok(parker);
  await deleteProfile(parker.id);
  await seedStarterProfiles();
  assert.equal((await profiles()).length, 3);
});
