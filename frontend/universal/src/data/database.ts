import { deleteDatabaseAsync, openDatabaseAsync, type SQLiteDatabase } from 'expo-sqlite';
import { stable } from './stable-json';
import { initializeStudentStorage } from './student-migration';
let database: Promise<SQLiteDatabase> | undefined;
let accountOwner: string | null = null;
let accountLoaded = false;
const observers = new Set<() => void>();
const previews = new Set<() => void>();
/** Refreshes visible data immediately after a durable local deletion. */
export function onDatabasePreview(callback: () => void) { previews.add(callback); return () => { previews.delete(callback); }; }
function notifyPreviews() { previews.forEach(callback => callback()); }
export function onDatabaseWrite(callback: () => void) { observers.add(callback); return () => { observers.delete(callback); }; }
/** A separate durable cache per authenticated account keeps offline edits across restarts. */
export async function selectAccountDatabase(userId: string) {
  await pending;
  if (accountOwner === userId && accountLoaded) return;
  if (database) await (await database).closeAsync();
  database = undefined; accountOwner = userId; accountLoaded = false;
  const db = await getDatabase();
  const owner = await db.getFirstAsync<{ value: string }>("SELECT value FROM settings WHERE key='accountOwner'");
  if (owner && JSON.parse(owner.value) !== userId) throw new Error('A helyi adatbázis másik fiókhoz tartozik.');
  await db.runAsync('INSERT OR REPLACE INTO settings VALUES (?,?)', 'accountOwner', JSON.stringify(userId));
  accountLoaded = true;
}
function accountFile(userId: string) { return `account-${userId.replace(/[^a-zA-Z0-9_-]/g, '_')}.db`; }
export async function clearAccountMemory() {
  await pending;
  if (database) await (await database).closeAsync();
  database = undefined; accountOwner = null; accountLoaded = false;
}
let pending: Promise<unknown> = Promise.resolve();

/** Local commits finish before notifying sync; network failures never roll back saved edits. */
export function write<T>(operation: (db: SQLiteDatabase) => Promise<T>, persist = true, preview = false): Promise<T> {
  let changed = false;
  const result = pending.then(async () => {
    const db = await getDatabase();
    if (!persist) return operation(db);
    const before = await db.getFirstAsync<{ total: number }>('SELECT total_changes() AS total');
    let value: T;
    async function commit() { value = await operation(db); }
    await db.withTransactionAsync(commit);
    const after = await db.getFirstAsync<{ total: number }>('SELECT total_changes() AS total');
    changed = before?.total !== after?.total;
    return value!;
  });
  pending = result.catch(() => undefined);
  if (persist) void result.then(() => { if (!changed) return; if (preview) notifyPreviews(); notifyObservers(); }, () => undefined);
  return result;
}
function notifyObservers() { observers.forEach(callback => callback()); }
export function getDatabase(): Promise<SQLiteDatabase> {
  database ??= initialize();
  return database;
}
async function initialize(): Promise<SQLiteDatabase> {
  const db = accountOwner ? await openDatabaseAsync(accountFile(accountOwner)) : await openDatabaseAsync(':memory:', { useNewConnection: true });
  await prepareDatabase(db);
  return db;
}
async function prepareDatabase(db: SQLiteDatabase) {
  await db.execAsync(`PRAGMA journal_mode=DELETE; PRAGMA synchronous=FULL; PRAGMA temp_store=MEMORY; PRAGMA foreign_keys=ON;
    CREATE TABLE IF NOT EXISTS profiles(id INTEGER PRIMARY KEY, name TEXT NOT NULL, isOwn INTEGER NOT NULL DEFAULT 0);
    CREATE UNIQUE INDEX IF NOT EXISTS own_profile ON profiles(isOwn) WHERE isOwn=1;
    CREATE TABLE IF NOT EXISTS settings(key TEXT PRIMARY KEY, value TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS sources(id TEXT PRIMARY KEY, profileId INTEGER NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
      format TEXT NOT NULL, content TEXT NOT NULL, name TEXT NOT NULL, revision TEXT NOT NULL,
      fromDate TEXT NOT NULL, toDate TEXT NOT NULL, isManual INTEGER NOT NULL DEFAULT 0);
    CREATE TABLE IF NOT EXISTS overrides(sourceId TEXT NOT NULL REFERENCES sources(id) ON DELETE CASCADE, key TEXT NOT NULL, patch TEXT NOT NULL, PRIMARY KEY(sourceId,key));
    CREATE TABLE IF NOT EXISTS events(sourceId TEXT NOT NULL, revision TEXT NOT NULL, key TEXT NOT NULL,
      title TEXT NOT NULL, originalTitle TEXT NOT NULL, start REAL NOT NULL, end REAL NOT NULL, location TEXT NOT NULL,
      kind TEXT NOT NULL, hidden INTEGER NOT NULL DEFAULT 0, base TEXT NOT NULL, notes TEXT NOT NULL DEFAULT '', PRIMARY KEY(sourceId,revision,key));
    CREATE INDEX IF NOT EXISTS event_window ON events(sourceId,revision,start,end);
    CREATE INDEX IF NOT EXISTS event_title ON events(sourceId,revision,originalTitle,start);
    CREATE INDEX IF NOT EXISTS source_profile ON sources(profileId);
    CREATE TABLE IF NOT EXISTS source_sync(sourceId TEXT PRIMARY KEY REFERENCES sources(id) ON DELETE CASCADE,
      url TEXT, autoSync INTEGER NOT NULL DEFAULT 0, importedAt REAL NOT NULL,
      lastAttempt REAL NOT NULL DEFAULT 0, lastSuccess REAL NOT NULL DEFAULT 0,
      lastError TEXT NOT NULL DEFAULT '', lastChange TEXT NOT NULL DEFAULT '');
    CREATE TABLE IF NOT EXISTS event_reminders(sourceId TEXT NOT NULL REFERENCES sources(id) ON DELETE CASCADE,
      key TEXT NOT NULL, excludeGlobal INTEGER NOT NULL DEFAULT 0, rules TEXT NOT NULL, PRIMARY KEY(sourceId,key));
    PRAGMA user_version=4;`);
  const columns = await db.getAllAsync<{ name: string }>('PRAGMA table_info(events)');
  if (!columns.some(column => column.name === 'notes')) await db.execAsync("ALTER TABLE events ADD COLUMN notes TEXT NOT NULL DEFAULT ''");
  await initializeStudentStorage(db);
  await db.runAsync("DELETE FROM events WHERE revision<? AND NOT EXISTS (SELECT 1 FROM sources WHERE sources.id=events.sourceId AND sources.revision=events.revision)", (Date.now() - 86400000).toString(36));
}
/** Settings are JSON so only one consistent value is restored after a restart. */
export async function readSetting<T>(key: string, fallback: T): Promise<T> {
  const row = await (await getDatabase()).getFirstAsync<{ value: string }>('SELECT value FROM settings WHERE key=?', key);
  if (!row) return fallback;
  try { return JSON.parse(row.value) as T; } catch { return fallback; }
}
export async function saveSetting(key: string, value: unknown): Promise<void> {
  await write(async db => {
    const previous = await db.getFirstAsync<{ value: string }>('SELECT value FROM settings WHERE key=?', key);
    try { if (previous && stable(JSON.parse(previous.value)) === stable(value)) return; } catch { /* Replace invalid legacy JSON. */ }
    await db.runAsync('INSERT INTO settings VALUES (?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value WHERE settings.value<>excluded.value', key, JSON.stringify(value)); });
}

/** Runs a serialized transaction on the same API supported by native and web SQLite. */
export async function transaction<T>(operation: (db: SQLiteDatabase) => Promise<T>, preview = false): Promise<T> {
  return write(operation, true, preview);
}

/** Explicit account deletion also removes its durable offline workspace. */
export async function eraseAccountDatabase(userId: string) {
  if (accountOwner === userId) await clearAccountMemory();
  await deleteDatabaseAsync(accountFile(userId));
}
