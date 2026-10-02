import type { SQLiteDatabase } from 'expo-sqlite';
import { importedCategory, searchableText } from '../domain/student';
import type { EventCategory } from '../domain/model';

/** Adds local student data without replacing existing calendar sources or overrides. */
export async function initializeStudentStorage(db: SQLiteDatabase): Promise<void> {
  const columns = await db.getAllAsync<{ name: string }>('PRAGMA table_info(events)');
  const needsCategory = !columns.some(column => column.name === 'category');
  if (needsCategory) await db.execAsync("ALTER TABLE events ADD COLUMN category TEXT NOT NULL DEFAULT 'lesson'");
  if (!columns.some(column => column.name === 'searchText')) await db.execAsync("ALTER TABLE events ADD COLUMN searchText TEXT NOT NULL DEFAULT ''");
  await db.execAsync(`CREATE TABLE IF NOT EXISTS notebook_links(id TEXT PRIMARY KEY,
    profileId INTEGER NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    notebookKey TEXT NOT NULL, subject TEXT NOT NULL, title TEXT NOT NULL, url TEXT NOT NULL, searchText TEXT NOT NULL);
    CREATE INDEX IF NOT EXISTS notebook_scope ON notebook_links(profileId,notebookKey);
    CREATE TABLE IF NOT EXISTS lesson_tasks(id TEXT PRIMARY KEY,
    profileId INTEGER NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    sourceId TEXT NOT NULL REFERENCES sources(id) ON DELETE CASCADE, eventKey TEXT NOT NULL,
    title TEXT NOT NULL, completed INTEGER NOT NULL DEFAULT 0, eventTitle TEXT NOT NULL, due REAL NOT NULL, searchText TEXT NOT NULL);
    CREATE INDEX IF NOT EXISTS task_occurrence ON lesson_tasks(sourceId,eventKey);
    PRAGMA user_version=5;`);
  await backfillSearch(db, needsCategory);
}

async function backfillSearch(db: SQLiteDatabase, needsCategory: boolean): Promise<void> {
  let rowId = 0;
  while (true) {
    const rows = await db.getAllAsync<{ rowid: number; title: string; location: string; notes: string; category: EventCategory }>("SELECT rowid,title,location,notes,category FROM events WHERE rowid>? AND searchText='' ORDER BY rowid LIMIT 500", rowId);
    if (!rows.length) return;
    for (const row of rows) {
      const category = needsCategory ? importedCategory(row.title) : row.category;
      await db.runAsync('UPDATE events SET category=?,searchText=? WHERE rowid=?', category, searchableText(`${row.title} ${row.location} ${row.notes}`), row.rowid);
    }
    rowId = rows.at(-1)!.rowid;
  }
}
