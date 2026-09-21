import type { SQLiteDatabase, SQLiteStatement } from 'expo-sqlite';
import type { Anchor, EventPatch, ImportControl, Occurrence, Source } from '../domain/model';
import { expandIcs } from '../domain/ics-import';
import { checkpoint, expandJson } from '../domain/json-import';
import { validateRange } from '../domain/time';
import { getDatabase, write, transaction } from './database';

export type SourceInput = Omit<Source, 'revision'>;
export type StagedSource = { input: SourceInput; revision: string; count: number; removed: number; added: number; lostOverrides: number };
const insertSql = 'INSERT INTO events VALUES (?,?,?,?,?,?,?,?,?,?,?)';
export function uniqueId(): string { return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`; }

/** Stages a complete source without exposing partial rows to calendar queries. */
export async function stageSource(input: SourceInput, anchor: Anchor, control: ImportControl): Promise<StagedSource> {
  validateRange(input.fromDate, input.toDate);
  if (input.content.length > 50000000) throw new Error('A fájl túl nagy (legfeljebb 50 MB).');
  return write(async db => buildStage(db, input, anchor, control));
}
async function buildStage(db: SQLiteDatabase, input: SourceInput, anchor: Anchor, control: ImportControl): Promise<StagedSource> {
  const revision = uniqueId();
  const range = { from: input.fromDate, to: input.toDate };
  const generator = input.format === 'ics' ? expandIcs(input.content, range, control) : expandJson(input.content, range, anchor, control);
  const statement = await db.prepareAsync(insertSql);
  let count = 0; let batch: Occurrence[] = [];
  try {
    for await (const event of generator) {
      await checkpoint(control, ++count);
      batch.push(event);
      batch = await flushBatch(db, statement, input.id, revision, batch);
    }
    await insertBatch(db, statement, input.id, revision, batch);
    await checkpoint(control, count);
    return { input, revision, count, ...await stageDifference(db, input.id, revision) };
  } catch (error) {
    await db.runAsync('DELETE FROM events WHERE sourceId=? AND revision=?', input.id, revision);
    throw error;
  } finally { await statement.finalizeAsync(); }
}
async function stageDifference(db: SQLiteDatabase, id: string, revision: string): Promise<{ removed: number; added: number; lostOverrides: number }> {
  const removed = await db.getFirstAsync<{ count: number }>(`SELECT count(*) count FROM events old JOIN sources s ON s.id=old.sourceId AND s.revision=old.revision WHERE s.id=? AND NOT EXISTS(SELECT 1 FROM events n WHERE n.sourceId=s.id AND n.revision=? AND n.key=old.key)`, id, revision);
  const added = await db.getFirstAsync<{ count: number }>(`SELECT count(*) count FROM events n WHERE n.sourceId=? AND n.revision=? AND NOT EXISTS(SELECT 1 FROM events old JOIN sources s ON s.id=old.sourceId AND s.revision=old.revision WHERE old.sourceId=n.sourceId AND old.key=n.key)`, id, revision);
  const lost = await db.getFirstAsync<{ count: number }>('SELECT count(*) count FROM overrides o WHERE o.sourceId=? AND NOT EXISTS(SELECT 1 FROM events e WHERE e.sourceId=o.sourceId AND e.key=o.key AND e.revision=?)', id, revision);
  return { removed: removed?.count ?? 0, added: added?.count ?? 0, lostOverrides: lost?.count ?? 0 };
}
/** Publishes multiple rebuilt sources and an optional A/B anchor atomically. */
export async function publishStages(stages: StagedSource[], anchor?: Anchor): Promise<void> {
  await transaction(async db => {
    for (const stage of stages) await publishOne(db, stage);
    if (anchor) await db.runAsync('INSERT OR REPLACE INTO settings VALUES (?,?)', 'anchor', JSON.stringify(anchor));
  });
}
async function publishOne(db: SQLiteDatabase, stage: StagedSource): Promise<void> {
  const { input, revision } = stage;
  await db.runAsync(`INSERT INTO sources VALUES (?,?,?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET content=excluded.content,format=excluded.format,name=excluded.name,revision=excluded.revision,fromDate=excluded.fromDate,toDate=excluded.toDate`, input.id, input.profileId, input.format, input.content, input.name, revision, input.fromDate, input.toDate, input.isManual);
  await db.runAsync('DELETE FROM overrides WHERE sourceId=? AND key NOT IN (SELECT key FROM events WHERE sourceId=? AND revision=?)', input.id, input.id, revision);
  const patches = await db.getAllAsync<{ key: string; patch: string }>('SELECT key,patch FROM overrides WHERE sourceId=?', input.id);
  for (const patch of patches) await applyStoredPatch(db, input.id, revision, patch);
  await db.runAsync('DELETE FROM events WHERE sourceId=? AND revision<>?', input.id, revision);
}
async function applyStoredPatch(db: SQLiteDatabase, id: string, revision: string, row: { key: string; patch: string }): Promise<void> {
  const event = await db.getFirstAsync<{ base: string }>('SELECT base FROM events WHERE sourceId=? AND revision=? AND key=?', id, revision, row.key);
  if (!event) return;
  const base: Occurrence = JSON.parse(event.base);
  const patch: EventPatch = JSON.parse(row.patch);
  const value = { ...base, ...patch };
  if (value.end < value.start) throw new Error('A forrásváltozás és a helyi időpont együtt érvénytelen. Állítsd vissza az érintett felülírást.');
  await db.runAsync('UPDATE events SET title=?,start=?,end=?,location=?,hidden=? WHERE sourceId=? AND revision=? AND key=?', value.title, value.start, value.end, value.location, Number(value.hidden ?? false), id, revision, row.key);
}
export async function discardStages(stages: StagedSource[]): Promise<void> {
  await write(async db => {
    for (const stage of stages) await db.runAsync('DELETE FROM events WHERE sourceId=? AND revision=? AND revision<>COALESCE((SELECT revision FROM sources WHERE id=?),\'\')', stage.input.id, stage.revision, stage.input.id);
  });
}
export async function sourceById(id: string): Promise<Source | null> {
  return (await getDatabase()).getFirstAsync<Source>('SELECT * FROM sources WHERE id=?', id);
}

async function insertBatch(db: SQLiteDatabase, statement: SQLiteStatement, id: string, revision: string, events: Occurrence[]): Promise<void> {
  async function insert() {
    for (const event of events) await statement.executeAsync(id, revision, event.key, event.title, event.originalTitle, event.start, event.end, event.location, event.kind, 0, JSON.stringify(event));
  }
  await db.withTransactionAsync(insert);
}

async function flushBatch(db: SQLiteDatabase, statement: SQLiteStatement, id: string, revision: string, batch: Occurrence[]): Promise<Occurrence[]> {
  if (batch.length < 100) return batch;
  await insertBatch(db, statement, id, revision, batch);
  return [];
}
