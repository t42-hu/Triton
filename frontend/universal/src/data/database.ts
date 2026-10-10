import { backupDatabaseAsync, deleteDatabaseAsync, openDatabaseAsync, type SQLiteDatabase } from 'expo-sqlite';
import { initializeStudentStorage } from './student-migration';
let database: Promise<SQLiteDatabase> | undefined;
let accountOwner: string | null = null;
let accountLoaded = false;
let migrationFile: string | null = null;
let serverCommit: ((db: SQLiteDatabase) => Promise<void>) | undefined;
export function configureServerCommit(commit: (db: SQLiteDatabase) => Promise<void>) { serverCommit = commit; }
const observers = new Set<() => void>();
const previews = new Set<() => void>();
/** Refreshes visible data while a deletion is being confirmed by the server, and after rollback. */
export function onDatabasePreview(callback: () => void) { previews.add(callback); return () => { previews.delete(callback); }; }
function notifyPreviews() { previews.forEach(callback => callback()); }
export function onDatabaseWrite(callback: () => void) { observers.add(callback); return () => { observers.delete(callback); }; }
/** Account data has no on-disk cache. Old files are read only to migrate existing data. */
export async function selectAccountDatabase(userId: string) {
  await pending;
  if (accountOwner === userId && accountLoaded) return;
  if (database) await (await database).closeAsync();
  database = undefined; accountOwner = userId; accountLoaded = false;
  const memory = await getDatabase();
  const name = `account-${userId.replace(/[^a-zA-Z0-9_-]/g, '_')}.db`;
  const legacy = await openDatabaseAsync(name);
  try {
    const exists = await legacy.getFirstAsync("SELECT name FROM sqlite_master WHERE type='table' AND name='settings'");
    if (exists) { await backupDatabaseAsync({ sourceDatabase: legacy, destDatabase: memory }); await prepareDatabase(memory); }
    migrationFile = name;
  } finally { await legacy.closeAsync(); }
  const sync = await memory.getFirstAsync<{value:string}>("SELECT value FROM settings WHERE key='cloudSync'");
  if (sync) await memory.runAsync('UPDATE settings SET value=? WHERE key=?', JSON.stringify({ ...JSON.parse(sync.value), sources: {} }), 'cloudSync');
  await memory.runAsync('INSERT OR REPLACE INTO settings VALUES (?,?)', 'accountOwner', JSON.stringify(userId));
  if (serverCommit) await serverCommit(memory);
  accountLoaded = true;
}
/** Delete the old cache only after all of its data was acknowledged by the server. */
export async function completeAccountMigration() {
  if (!migrationFile) return;
  const name = migrationFile;
  await deleteDatabaseAsync(name); migrationFile = null;
}
export async function clearAccountMemory() {
  await pending;
  if (database) await (await database).closeAsync();
  database = undefined; accountOwner = null; accountLoaded = false; migrationFile = null;
}
let pending: Promise<unknown> = Promise.resolve();

/** Serializes writers so asynchronous native/web transactions cannot interleave. */
export function write<T>(operation: (db: SQLiteDatabase) => Promise<T>, persist = true, preview = false): Promise<T> {
  const result = pending.then(async () => {
    const db = await getDatabase();
    if (!persist || !serverCommit || !accountOwner) return operation(db);
    const backup = await openDatabaseAsync(':memory:', { useNewConnection: true });
    try {
      await backupDatabaseAsync({ sourceDatabase: db, destDatabase: backup });
      const value = await operation(db);
      if (preview) notifyPreviews();
      await serverCommit(db);
      return value;
    } catch (error) {
      await backupDatabaseAsync({ sourceDatabase: backup, destDatabase: db });
      if (preview) notifyPreviews();
      throw error;
    } finally { await backup.closeAsync(); }
  });
  pending = result.catch(() => undefined);
  void result.then(notifyObservers, () => undefined);
  return result;
}
function notifyObservers() { observers.forEach(callback => callback()); }
export function getDatabase(): Promise<SQLiteDatabase> {
  database ??= initialize();
  return database;
}
async function initialize(): Promise<SQLiteDatabase> {
  const db = await openDatabaseAsync(':memory:', { useNewConnection: true });
  await prepareDatabase(db);
  return db;
}
async function prepareDatabase(db: SQLiteDatabase) {
  await db.execAsync(`PRAGMA journal_mode=MEMORY; PRAGMA temp_store=MEMORY; PRAGMA foreign_keys=ON;
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
  await write(async db => { await db.runAsync('INSERT OR REPLACE INTO settings VALUES (?,?)', key, JSON.stringify(value)); });
}

/** Runs a serialized transaction on the same API supported by native and web SQLite. */
export async function transaction<T>(operation: (db: SQLiteDatabase) => Promise<T>, preview = false): Promise<T> {
  return write(async db => {
    let result: T;
    async function commit() { result = await operation(db); }
    await db.withTransactionAsync(commit);
    return result!;
  }, true, preview);
}

/** Account deletion removes any pre-migration file as well as transient memory. */
export async function eraseAccountDatabase(userId: string) {
  if (accountOwner === userId) await clearAccountMemory();
  await deleteDatabaseAsync(`account-${userId.replace(/[^a-zA-Z0-9_-]/g, '_')}.db`);
}
