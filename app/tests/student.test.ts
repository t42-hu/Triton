import assert from 'node:assert/strict';
import { test } from 'node:test';
import { openDatabaseAsync } from 'expo-sqlite';
import type { DisplayEvent } from '../src/domain/model';
import { notebookIdentity, notebookUrl, subjectName, importedCategory } from '../src/domain/student';
import { dailyAnalysis, freeSlots, scheduleConflicts } from '../src/domain/schedule-analysis';
import { fromWall } from '../src/domain/time';
import { addNotebookLink, notebookLinks, addLessonTask, lessonTasks, searchStudentData, setTaskCompleted, taskEvent, lessonRooms } from '../src/data/student-repository';
import { createManualEvent } from '../src/data/manual-event';
import { saveProfile, deleteProfile, updateEvents, visibleEvents } from '../src/data/repository';
import { publishStages, stageSource } from '../src/data/importer';
import { initializeStudentStorage } from '../src/data/student-migration';
import { saveEventReminders, eventReminders } from '../src/data/reminders';
import { coveredWindows } from '../src/data/free-time';
import { hasMappedRoom } from '../src/features/room-location';

const anchor = { date: '2026-09-07', week: 'A' as const };
function event(title: string, start: string, end: string, patch: Partial<DisplayEvent> = {}): DisplayEvent {
  return { key: title, title, originalTitle: title, start: fromWall(start), end: fromWall(end), location: '', kind: 'timed', category: 'lesson', sourceId: title, profileId: 1, hidden: 0, base: '{}', patch: null, ...patch };
}

test('notebooks group teaching formats but retain distinct numbered subjects and personal event identity', () => {
  const lecture = event('Fizika - előadás (NIXFIZ_EA_01)', '2026-09-07T08:00', '2026-09-07T09:00');
  const practice = { ...lecture, originalTitle: 'Fizika (gyakorlat) NIXFIZ_GY_02' };
  assert.equal(subjectName(lecture.originalTitle), 'Fizika');
  assert.equal(notebookIdentity(lecture), notebookIdentity(practice));
  assert.equal(subjectName('NIXFIZ_EA_01'), subjectName('NIXFIZ_GY_02'));
  assert.notEqual(notebookIdentity({ ...lecture, originalTitle: 'Fizika 1' }), notebookIdentity({ ...lecture, originalTitle: 'Fizika 2' }));
  assert.notEqual(notebookIdentity({ ...lecture, category: 'event' }), notebookIdentity({ ...lecture, category: 'event', key: 'another' }));
  assert.equal(notebookUrl('example.com/jegyzet'), 'https://example.com/jegyzet');
  assert.throws(() => notebookUrl('javascript:alert(1)'));
  assert.throws(() => notebookUrl('https://user:password@example.com'));
  assert.equal(importedCategory('Fizika ZH'), 'test');
  assert.equal(importedCategory('Anyagvizsgálat'), 'lesson');
});

test('daily load merges overlaps, preserves real gaps and common free time respects all-day programs', () => {
  const events = [event('A', '2026-09-07T08:00', '2026-09-07T10:00'), event('B', '2026-09-07T09:00', '2026-09-07T11:00'), event('C', '2026-09-07T12:00', '2026-09-07T13:00')];
  const analysis = dailyAnalysis(events, '2026-09-07');
  assert.equal(analysis.minutes, 240); assert.equal(analysis.conflicts.length, 1);
  assert.deepEqual(analysis.gaps, [{ start: fromWall('2026-09-07T11:00'), end: fromWall('2026-09-07T12:00') }]);
  assert.equal(scheduleConflicts([events[0], { ...events[1], start: events[0].end }]).length, 0);
  const deadline = event('Beadandó', '2026-09-07', '2026-09-08', { category: 'assignment', kind: 'allDay' });
  assert.equal(freeSlots([...events, deadline], fromWall('2026-09-07T08:00'), fromWall('2026-09-07T14:00'), 60).length, 2);
  assert.equal(freeSlots([...events, { ...deadline, category: 'event' }], fromWall('2026-09-07T08:00'), fromWall('2026-09-07T14:00')).length, 0);
  assert.equal(freeSlots([{ ...deadline, category: 'event', hidden: 1 }], fromWall('2026-09-07T08:00'), fromWall('2026-09-07T14:00')).length, 1);
  assert.equal(dailyAnalysis([event('Éjszaka', '2026-10-25T00:00', '2026-10-25T04:00')], '2026-10-25').minutes, 300);
  assert.equal(freeSlots([{ ...deadline, category: 'event' }], fromWall('2026-09-08T08:00'), fromWall('2026-09-08T14:00')).length, 1);
});

test('links, tasks, categories and accent-insensitive search survive edits and source refreshes', async () => {
  const profileId = await saveProfile('Student features');
  const lecture = await createManualEvent(profileId, { id: 'lecture', title: 'Fizika előadás', category: 'lesson', kind: 'timed', start: '2026-09-07T08:00:00+02:00', end: '2026-09-07T09:30:00+02:00', location: 'BA.F.08' }, anchor);
  const practice = await createManualEvent(profileId, { id: 'practice', title: 'Fizika gyakorlat', category: 'lesson', kind: 'timed', start: '2026-09-08T08:00:00+02:00', end: '2026-09-08T09:30:00+02:00' }, anchor);
  await addNotebookLink(lecture, 'Árvíztűrő jegyzetek', 'https://example.com/fizika');
  assert.equal((await notebookLinks(practice)).length, 1);
  await addLessonTask(lecture, 'Olvasd el az összefoglalót');
  assert.equal((await lessonTasks(profileId, practice)).length, 0);
  const [task] = await lessonTasks(profileId, lecture);
  await updateEvents([{ event: lecture, patch: { start: fromWall('2026-09-07T10:00'), end: fromWall('2026-09-07T11:30'), notes: 'Új témakör', category: 'exam' } }]);
  assert.equal((await lessonTasks(profileId))[0].due, fromWall('2026-09-07T10:00'));
  assert.equal((await taskEvent(task))?.category, 'exam');
  assert.equal((await searchStudentData('ARVIZTURO', profileId)).links.length, 1);
  assert.equal((await searchStudentData('temakor', profileId)).events.length, 1);
  assert.equal((await searchStudentData('osszefoglalot', profileId)).tasks.length, 1);
  await setTaskCompleted(task.id, true); assert.equal((await lessonTasks(profileId))[0].completed, 1);
  const otherId = await saveProfile('Other student');
  assert.equal((await searchStudentData('fizika', otherId)).links.length, 0);
  await deleteProfile(profileId); assert.equal((await searchStudentData('ARVIZTURO')).links.length, 0);
  await deleteProfile(otherId);
});

test('general events keep their category and reminders and midnight creation uses local dates', async () => {
  const profileId = await saveProfile('Personal calendar');
  const created = await createManualEvent(profileId, { id: 'midnight', title: 'Születésnap', category: 'event', kind: 'timed', start: '2026-09-07T00:30:00+02:00', end: '2026-09-07T01:30:00+02:00', location: 'BA.F.08' }, anchor);
  assert.equal(created.category, 'event'); assert.equal((await visibleEvents(profileId, '2026-09-07', 1, false)).length, 1);
  assert.deepEqual(await lessonRooms(profileId), []);
  await saveEventReminders(created, { excludeGlobal: true, rules: [{ minutes: 20, profile: 'standard' }] });
  assert.equal((await eventReminders(created)).rules[0].minutes, 20);
  assert.ok(hasMappedRoom('BA.F.08')); assert.equal(hasMappedRoom('BA.F.999'), false); assert.equal(hasMappedRoom('X-123'), false);
  await deleteProfile(profileId);
});

test('legacy migration backfills categories/search without losing stored notes and remains idempotent', async () => {
  const db = await openDatabaseAsync('legacy');
  await db.execAsync("CREATE TABLE profiles(id INTEGER PRIMARY KEY); CREATE TABLE sources(id TEXT PRIMARY KEY); CREATE TABLE events(title TEXT,location TEXT,notes TEXT); INSERT INTO events VALUES ('Fizika ZH','F.08','Árvíztűrő');");
  await initializeStudentStorage(db); await initializeStudentStorage(db);
  const row = await db.getFirstAsync<{ category: string; searchText: string; notes: string }>('SELECT * FROM events');
  assert.equal(row?.category, 'test'); assert.equal(row?.notes, 'Árvíztűrő'); assert.ok(row?.searchText.includes('arvizturo'));
});

test('category and note patches keep search current when an imported source is refreshed', async () => {
  const profileId = await saveProfile('Refresh search');
  const input = { id: `${profileId}:import`, profileId, format: 'json' as const, content: JSON.stringify({ version: 1, events: [{ id: 'class', title: 'Fizika', kind: 'timed', start: '2026-09-07T08:00:00+02:00', end: '2026-09-07T09:00:00+02:00' }] }), name: 'Import', fromDate: '2026-09-07', toDate: '2026-09-08', isManual: 0 };
  const control = { signal: new AbortController().signal, progress: () => undefined };
  await publishStages([await stageSource(input, anchor, control)]);
  const [original] = await visibleEvents(profileId, '2026-09-07', 1, false);
  await updateEvents([{ event: original, patch: { category: 'test', notes: 'Felkészülés' } }]);
  await addLessonTask(original, 'Felkészülni');
  await publishStages([await stageSource(input, anchor, control)]);
  assert.equal((await searchStudentData('felkeszules', profileId)).events[0].category, 'test');
  assert.equal((await lessonTasks(profileId)).length, 1);
  await deleteProfile(profileId);
});

test('common free time spans midnight and breaks at missing imported coverage', () => {
  const source = (fromDate: string, toDate: string, isManual = 0) => ({ fromDate, toDate, isManual });
  const full = { id: 1, sources: [source('2026-10-01', '2026-10-04')] };
  const split = { id: 2, sources: [source('2026-10-01', '2026-10-02'), source('2026-10-04', '2026-10-04'), source('2026-10-03', '2026-10-03', 1)] };
  const start = fromWall('2026-10-01T08:00'); const end = fromWall('2026-10-04T20:00');
  const result = coveredWindows([full, split], start, end);
  assert.deepEqual(result.missing, [{ date: '2026-10-03', profileIds: [2] }]);
  assert.deepEqual(result.windows, [{ start, end: fromWall('2026-10-03') }, { start: fromWall('2026-10-04'), end }]);
  const continuous = coveredWindows([full, { ...full, id: 2 }], start, end);
  assert.deepEqual(continuous.windows, [{ start, end }]);
  assert.deepEqual(freeSlots([], start, end), [{ start, end }]);
  const eventAtMidnight = event('Program', '2026-10-02T23:00', '2026-10-03T01:00');
  assert.deepEqual(freeSlots([eventAtMidnight], start, end), [{ start, end: eventAtMidnight.start }, { start: eventAtMidnight.end, end }]);
});
