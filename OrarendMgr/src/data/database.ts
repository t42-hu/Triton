import { openDatabaseAsync, type SQLiteDatabase } from 'expo-sqlite';
let database: Promise<SQLiteDatabase> | undefined;
let pending: Promise<unknown> = Promise.resolve();

/** Serializes writers so asynchronous native/web transactions cannot interleave. */
export function write<T>(operation: (db: SQLiteDatabase) => Promise<T>): Promise<T> {
  const result = pending.then(async () => operation(await getDatabase()));
  pending = result.catch(() => undefined);
  return result;
}
export function getDatabase(): Promise<SQLiteDatabase> {
  database ??= initialize();
  return database;
}
async function initialize(): Promise<SQLiteDatabase> {
  const db = await openDatabaseAsync('orarend.db');
  await db.execAsync(`PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON;
    CREATE TABLE IF NOT EXISTS profiles(id INTEGER PRIMARY KEY, name TEXT NOT NULL, isOwn INTEGER NOT NULL DEFAULT 0);
    CREATE UNIQUE INDEX IF NOT EXISTS own_profile ON profiles(isOwn) WHERE isOwn=1;
    CREATE TABLE IF NOT EXISTS settings(key TEXT PRIMARY KEY, value TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS sources(id TEXT PRIMARY KEY, profileId INTEGER NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
      format TEXT NOT NULL, content TEXT NOT NULL, name TEXT NOT NULL, revision TEXT NOT NULL,
      fromDate TEXT NOT NULL, toDate TEXT NOT NULL, isManual INTEGER NOT NULL DEFAULT 0);
    CREATE TABLE IF NOT EXISTS overrides(sourceId TEXT NOT NULL REFERENCES sources(id) ON DELETE CASCADE, key TEXT NOT NULL, patch TEXT NOT NULL, PRIMARY KEY(sourceId,key));
    CREATE TABLE IF NOT EXISTS events(sourceId TEXT NOT NULL, revision TEXT NOT NULL, key TEXT NOT NULL,
      title TEXT NOT NULL, originalTitle TEXT NOT NULL, start REAL NOT NULL, end REAL NOT NULL, location TEXT NOT NULL,
      kind TEXT NOT NULL, hidden INTEGER NOT NULL DEFAULT 0, base TEXT NOT NULL, PRIMARY KEY(sourceId,revision,key));
    CREATE INDEX IF NOT EXISTS event_window ON events(sourceId,revision,start,end);
    CREATE INDEX IF NOT EXISTS event_title ON events(sourceId,revision,originalTitle,start);
    CREATE INDEX IF NOT EXISTS source_profile ON sources(profileId);
    PRAGMA user_version=1;`);
  await db.runAsync("DELETE FROM events WHERE revision<? AND NOT EXISTS (SELECT 1 FROM sources WHERE sources.id=events.sourceId AND sources.revision=events.revision)", (Date.now() - 86400000).toString(36));
  return db;
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
export async function transaction<T>(operation: (db: SQLiteDatabase) => Promise<T>): Promise<T> {
  return write(async db => {
    let result: T;
    async function commit() { result = await operation(db); }
    await db.withTransactionAsync(commit);
    return result!;
  });
}
