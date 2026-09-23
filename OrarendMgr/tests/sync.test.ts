import assert from 'node:assert/strict';
import { test } from 'node:test';
import { calendarUrl, fetchCalendar, MAX_CALENDAR_BYTES } from '../src/data/calendar-fetch';
import { disconnectCalendar, SYNC_INTERVAL, syncOwnCalendar, syncStatus } from '../src/data/calendar-sync';
import { discardStages, publishStages, sourceById, stageSource } from '../src/data/importer';
import { deleteProfile, ownProfile, profiles, saveProfile, updateEvents, visibleEvents } from '../src/data/repository';

const anchor = { date: '2026-09-07', week: 'A' as const };
const url = 'https://calendar.example.test/private.ics';
const control = () => ({ signal: new AbortController().signal, progress: () => undefined });
const course = (title: string, uid = 'course') => `BEGIN:VEVENT\r\nUID:${uid}\r\nDTSTART:20260907T080000\r\nDTEND:20260907T093000\r\nSUMMARY:${title}\r\nLOCATION:A1\r\nEND:VEVENT`;
const calendar = (...events: string[]) => `BEGIN:VCALENDAR\r\nVERSION:2.0\r\nPRODID:-//Triton Test//EN\r\n${events.join('\r\n')}\r\nEND:VCALENDAR\r\n`;
async function subscribe() {
  await saveProfile('Own');
  const [profile] = await profiles();
  const input = { id: `${profile.id}:import`, profileId: profile.id, format: 'ics' as const, content: calendar(course('Original')), name: 'Own', fromDate: '2026-09-01', toDate: '2026-12-31', isManual: 0 };
  const stage = await stageSource(input, anchor, control());
  stage.connection = { url, autoSync: 1, fetchedAt: 1 };
  await publishStages([stage]);
  return { profile, input };
}

test('subscription URL and response validation reject credentials, unsafe schemes, HTML, truncation and oversized bodies', async t => {
  assert.equal(calendarUrl(' webcal://example.test/feed#fragment '), 'https://example.test/feed');
  for (const input of ['http://example.test', 'https://user:secret@example.test', 'javascript:alert(1)', 'broken']) assert.throws(() => calendarUrl(input));
  for (const content of ['<html>Login</html>', 'BEGIN:VCALENDAR\r\nVERSION:2.0']) {
    t.mock.method(globalThis, 'fetch', async () => new Response(content));
    await assert.rejects(fetchCalendar(url), /ICS/);
  }
  t.mock.method(globalThis, 'fetch', async () => new Response('x', { headers: { 'content-length': String(MAX_CALENDAR_BYTES + 1) } }));
  await assert.rejects(fetchCalendar(url), /5 MB/);
  t.mock.method(globalThis, 'fetch', async (_url: string, init: RequestInit) => {
    assert.equal(init.credentials, 'omit'); assert.equal(init.referrerPolicy, 'no-referrer');
    if (init.signal?.aborted) throw new DOMException('Aborted', 'AbortError');
    return new Response(calendar(course('Valid')));
  });
  await assert.rejects(fetchCalendar(url, AbortSignal.abort()), /megszakítva/);
  assert.match(await fetchCalendar(url), /Valid/);
});

test('refresh updates atomically, preserves overrides, detects changes and shares a persisted 15-minute cooldown', async t => {
  const { profile, input } = await subscribe();
  t.after(() => deleteProfile(profile.id));
  const [original] = await visibleEvents(profile.id, '2026-09-07', 7, false);
  await updateEvents([{ event: original, patch: { location: 'Local room' } }]);
  const request = t.mock.method(globalThis, 'fetch', async () => new Response(calendar(course('Changed'), course('New', 'added'))));
  const now = Date.now();
  const results = await Promise.all([syncOwnCalendar(now), syncOwnCalendar(now)]);
  assert.deepEqual(results.map(result => result.status).sort(), ['skipped', 'success']);
  assert.equal(request.mock.callCount(), 1);
  assert.equal(results.find(result => result.status === 'success')?.summary, 'Új: 1, módosult: 1, törölt: 0 alkalom.');
  const events = await visibleEvents(profile.id, '2026-09-07', 7, false);
  assert.equal(events.find(event => event.title === 'Changed')?.location, 'Local room');
  assert.equal((await syncOwnCalendar(now + SYNC_INTERVAL - 1)).status, 'skipped');
  assert.equal((await syncOwnCalendar(now + SYNC_INTERVAL)).summary, '');
  assert.equal((await syncStatus(input.id))?.lastError, '');
  request.mock.mockImplementation(async () => new Response(calendar(course('Changed'))));
  assert.equal((await syncOwnCalendar(now + 2 * SYNC_INTERVAL)).summary, 'Új: 0, módosult: 0, törölt: 1 alkalom.');
});

test('failed refresh retains cached data and last success without immediate retries', async t => {
  const { profile, input } = await subscribe();
  t.after(() => deleteProfile(profile.id));
  const before = await sourceById(input.id);
  const request = t.mock.method(globalThis, 'fetch', async () => new Response('Unavailable', { status: 503 }));
  const now = Date.now();
  assert.equal((await syncOwnCalendar(now)).status, 'failed');
  assert.equal((await sourceById(input.id))?.revision, before?.revision);
  assert.equal((await syncStatus(input.id))?.lastSuccess, 1);
  assert.ok((await syncStatus(input.id))?.lastError);
  assert.equal((await syncOwnCalendar(now + 1)).status, 'skipped');
  assert.equal(request.mock.callCount(), 1);
  request.mock.mockImplementation(async () => new Response(calendar('BEGIN:VEVENT\r\nUID:invalid\r\nEND:VEVENT')));
  assert.equal((await syncOwnCalendar(now + SYNC_INTERVAL)).status, 'failed');
  assert.equal((await sourceById(input.id))?.revision, before?.revision);
});

test('disconnect during download cannot restore the subscription or publish late data', async t => {
  const { profile, input } = await subscribe();
  t.after(() => deleteProfile(profile.id));
  const before = await sourceById(input.id);
  t.mock.method(globalThis, 'fetch', async () => {
    await disconnectCalendar(input.id);
    return new Response(calendar(course('Late result')));
  });
  assert.equal((await syncOwnCalendar()).status, 'failed');
  assert.equal((await sourceById(input.id))?.revision, before?.revision);
  assert.equal((await syncStatus(input.id))?.url, null);
  assert.equal((await syncOwnCalendar(Date.now() + SYNC_INTERVAL)).status, 'skipped');
});

test('static file replacement detaches sync and stale import previews cannot overwrite it', async t => {
  const { profile, input } = await subscribe();
  t.after(() => deleteProfile(profile.id));
  const stale = await stageSource(input, anchor, control());
  const replacement = await stageSource({ ...input, content: calendar(course('File')) }, anchor, control());
  replacement.connection = null;
  await publishStages([replacement]);
  await assert.rejects(publishStages([stale]), /időközben/);
  await discardStages([stale]);
  assert.equal((await syncStatus(input.id))?.url, null);
  assert.equal((await syncOwnCalendar()).status, 'skipped');
  assert.equal((await visibleEvents(profile.id, '2026-09-07', 7, false))[0].title, 'File');
});

test('only the current own profile can refresh, including ownership changes in flight', async t => {
  const { profile, input } = await subscribe();
  await saveProfile('Peer');
  const peer = (await profiles()).find(item => item.id !== profile.id)!;
  t.after(async () => { await deleteProfile(profile.id); await deleteProfile(peer.id); });
  const before = await sourceById(input.id);
  t.mock.method(globalThis, 'fetch', async () => {
    await ownProfile(peer.id);
    return new Response(calendar(course('Late result')));
  });
  assert.equal((await syncOwnCalendar()).status, 'failed');
  assert.equal((await sourceById(input.id))?.revision, before?.revision);
  assert.equal((await syncOwnCalendar(Date.now() + SYNC_INTERVAL)).status, 'skipped');
});
