import { deleteDatabaseAsync, openDatabaseAsync, type SQLiteDatabase } from 'expo-sqlite';
import { readSetting, saveSetting, transaction } from './database';
const tables = ['profiles', 'sources', 'events', 'overrides', 'source_sync', 'event_reminders', 'lesson_tasks', 'notebook_links', 'settings'] as const;
type Row = Record<string, string | number | null>;
async function legacyRows(db: SQLiteDatabase, table: string): Promise<Row[]> {
  const exists = await db.getFirstAsync("SELECT name FROM sqlite_master WHERE type='table' AND name=?", table);
  return exists ? db.getAllAsync<Row>(`SELECT * FROM ${table}`) : [];
}
export async function legacyProfileCount(userId: string) {
  if (await readSetting('legacyDecision', false)) return 0;
  const db = await openDatabaseAsync('orarend.db');
  try {
    const settings = await legacyRows(db, 'settings');
    const transferred = settings.find(row => row.key === 'legacyTransferredTo');
    if (transferred && JSON.parse(String(transferred.value)) !== userId) return 0;
    return (await legacyRows(db, 'profiles')).length;
  } finally { await db.closeAsync(); }
}
/** Copies old local data only after the account owner explicitly chooses to import it. */
export async function finishLegacyChoice(userId: string, include: boolean) {
  if (include) { await copyLegacy(userId); await deleteDatabaseAsync('orarend.db'); }
  else await saveSetting('legacyDecision', true);
}
async function copyLegacy(userId: string) {
  const legacy = await openDatabaseAsync('orarend.db');
  try {
    const rows = await Promise.all(tables.map(table => legacyRows(legacy, table)));
    const owner = rows[tables.indexOf('settings')].find(row => row.key === 'legacyTransferredTo');
    if (owner && JSON.parse(String(owner.value)) !== userId) throw new Error('Ezeket az adatokat már másik fiókba vitték át.');
    await transaction(db => mergeLegacy(db, rows));
  } finally { await legacy.closeAsync(); }
}
async function copyRows(db: SQLiteDatabase, table: string, rows: Row[]) {
  const columns = new Set((await db.getAllAsync<{ name: string }>(`PRAGMA table_info(${table})`)).map(row => row.name));
  for (const row of rows) {
    if (table === 'settings' && /^(cloud|accountOwner|legacy)/.test(String(row.key))) continue;
    const keys = Object.keys(row).filter(key => columns.has(key));
    await db.runAsync(`INSERT OR REPLACE INTO ${table} (${keys.map(key => `"${key}"`).join(',')}) VALUES (${keys.map(() => '?').join(',')})`, ...keys.map(key => row[key]));
  }
}

function remapKey(key: string, ids: Map<string | number, string | number> | Map<number, number> | Map<string, string>) {
  const parts = JSON.parse(key); parts[0] = (ids as Map<string | number, string | number>).get(parts[0]) ?? parts[0]; return JSON.stringify(parts);
}
async function mergeSetting(db: SQLiteDatabase, row: Row, profileIds: Map<number, number>, sourceIds: Map<string, string>) {
  const key = String(row.key);
  if (/^(cloud|accountOwner|legacy)/.test(key)) return;
  const previous = await db.getFirstAsync<{ value: string }>('SELECT value FROM settings WHERE key=?', key);
  let value = JSON.parse(String(row.value));
  if (key === 'view') value = { ...value, left: profileIds.get(value.left) ?? value.left, right: profileIds.get(value.right) ?? value.right, openProfiles: value.openProfiles?.map((id: number) => profileIds.get(id) ?? id) };
  if (key === 'setupProfileId') value = profileIds.get(value) ?? value;
  if (key === 'eventColors') {
    value.series = Object.fromEntries(Object.entries(value.series).map(([id, color]) => [remapKey(id, profileIds), color]));
    value.occurrences = Object.fromEntries(Object.entries(value.occurrences).map(([id, color]) => [remapKey(id, sourceIds), color]));
    if (previous) { const current = JSON.parse(previous.value); value = { ...current, series: { ...value.series, ...current.series }, occurrences: { ...value.occurrences, ...current.occurrences } }; }
  } else if (key === 'savedColors' && previous) value = [...new Set([...JSON.parse(previous.value), ...value])];
  else if (previous) return;
  await db.runAsync('INSERT OR REPLACE INTO settings VALUES (?,?)', key, JSON.stringify(value));
}

async function mergeLegacy(db: SQLiteDatabase, rows: Row[][]) {
  const existing = await db.getAllAsync<Row>('SELECT * FROM profiles');
  const profileIds = new Map<number, number>(); const sourceIds = new Map<string, string>();
  const names = new Set(existing.map(row => String(row.name).toLocaleLowerCase('hu')));
  let nextId = Math.max(0, ...existing.map(row => Number(row.id)));
  let own = existing.some(row => row.isOwn);
  for (const row of rows[0]) {
    const oldId = Number(row.id); const id = existing.length ? ++nextId : oldId;
    let name = String(row.name); let suffix = 1;
    while (names.has(name.toLocaleLowerCase('hu'))) name = `${row.name} (átvitt ${suffix++})`;
    names.add(name.toLocaleLowerCase('hu')); profileIds.set(oldId, id);
    const isOwn = Number(!own && Boolean(row.isOwn)); own ||= Boolean(isOwn);
    await copyRows(db, 'profiles', [{ ...row, id, name, isOwn }]);
  }
  for (const row of rows[1]) {
    let id = String(row.id);
    while (await db.getFirstAsync('SELECT id FROM sources WHERE id=?', id)) id = `legacy-${id}`;
    sourceIds.set(String(row.id), id);
    await copyRows(db, 'sources', [{ ...row, id, profileId: profileIds.get(Number(row.profileId))! }]);
  }
  for (let i = 2; i < tables.length - 1; i++) await copyRelated(db, tables[i], rows[i], profileIds, sourceIds);
  for (const row of rows.at(-1)!) await mergeSetting(db, row, profileIds, sourceIds);
  await db.runAsync('INSERT OR REPLACE INTO settings VALUES (?,?)', 'legacyDecision', 'true');
}
async function copyRelated(db: SQLiteDatabase, table: string, rows: Row[], profileIds: Map<number, number>, sourceIds: Map<string, string>) {
  for (const original of rows) {
    const row = { ...original };
    if (row.profileId != null) row.profileId = profileIds.get(Number(row.profileId))!;
    if (row.sourceId != null) row.sourceId = sourceIds.get(String(row.sourceId))!;
    if (row.id != null) row.id = await uniqueLegacyId(db, table, row.id);
    if (typeof row.notebookKey === 'string') row.notebookKey = row.notebookKey.replace(/^(lms:)?event:(.+)$/, (_, prefix, value) => `${prefix ?? ''}event:${remapKey(value, sourceIds)}`);
    await copyRows(db, table, [row]);
  }
}

async function uniqueLegacyId(db: SQLiteDatabase, table: string, id: string | number) {
  while (await db.getFirstAsync(`SELECT id FROM ${table} WHERE id=?`, id)) id = `legacy-${id}`;
  return id;
}
