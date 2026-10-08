import { openDatabaseAsync, type SQLiteDatabase } from 'expo-sqlite';
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
  if (include) await copyLegacy(userId);
  await saveSetting('legacyDecision', true);
}
async function copyLegacy(userId: string) {
  const legacy = await openDatabaseAsync('orarend.db');
  try {
    const rows = await Promise.all(tables.map(table => legacyRows(legacy, table)));
    await transaction(async db => {
      if (await db.getFirstAsync('SELECT id FROM profiles LIMIT 1')) throw new Error('A helyi adatok átvitele csak üres fiókgyorsítótárba lehetséges.');
      for (let i = 0; i < tables.length; i++) await copyRows(db, tables[i], rows[i]);
    });
    await legacy.runAsync('INSERT OR REPLACE INTO settings VALUES (?,?)', 'legacyTransferredTo', JSON.stringify(userId));
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
