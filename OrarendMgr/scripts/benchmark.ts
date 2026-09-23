import assert from 'node:assert/strict';
import { stageSource, publishStages } from '../src/data/importer';
import { profiles, saveProfile, visibleEvents } from '../src/data/repository';
import { addDays } from '../src/domain/time';
import { commonKeys } from '../src/domain/comparison';
import { dayLayout } from '../src/features/calendar-layout';

function fixture(index: number) {
  const date = addDays('2026-01-01', Math.floor(index / 48));
  const hour = String(Math.floor(index % 48 / 2)).padStart(2, '0');
  const minute = index % 2 ? '30' : '00';
  const endMinute = index % 2 ? '50' : '20';
  return { id: `event-${index}`, title: `Kurzus ${index % 30}`, kind: 'timed', start: `${date}T${hour}:${minute}:00Z`, end: `${date}T${hour}:${endMinute}:00Z`, location: `A${index % 10}` };
}
async function benchmark() {
  const source = JSON.stringify({ version: 1, events: Array.from({ length: 15000 }, (_, index) => fixture(index)) });
  const started = performance.now();
  for (let profileIndex = 0; profileIndex < 15; profileIndex++) {
    await saveProfile(`Benchmark ${profileIndex}`);
    const profile = (await profiles()).find(profile => profile.name === `Benchmark ${profileIndex}`)!;
    const stage = await stageSource({ id: `${profile.id}:import`, profileId: profile.id, format: 'json', content: source, name: 'benchmark', fromDate: '2026-01-01', toDate: '2026-12-31', isManual: 0 }, { date: '2026-01-05', week: 'A' }, { signal: new AbortController().signal, progress: () => undefined });
    assert.equal(stage.count, 15000); await publishStages([stage]);
  }
  const importMs = performance.now() - started;
  const ids = await profiles(); const queryStarted = performance.now();
  const [left, right] = await Promise.all(ids.slice(0, 2).map(profile => visibleEvents(profile.id, '2026-09-21', 7, false)));
  const matches = commonKeys(left, right);
  for (let day = 0; day < 7; day++) dayLayout(left, addDays('2026-09-21', day));
  assert.equal(matches.size, left.length);
  console.log(JSON.stringify({ engine: 'Node SQLite; not a device benchmark', profiles: 15, occurrences: 225000, importMs: Math.round(importMs), queryCompareLayoutMs: Math.round(performance.now() - queryStarted), visibleEvents: left.length, heapMB: Math.round(process.memoryUsage().heapUsed / 1048576) }, null, 2));
}
void benchmark();
