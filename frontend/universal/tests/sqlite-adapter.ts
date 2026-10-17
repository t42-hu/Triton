import { DatabaseSync, type SQLInputValue } from 'node:sqlite';

import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
const directory = mkdtempSync(join(tmpdir(), 'triton-sqlite-test-'));
process.on('exit', () => rmSync(directory, { recursive: true, force: true }));

/** Uses real temporary SQLite files so account reopen tests exercise durable storage. */
export async function openDatabaseAsync(name?: string, options?: { useNewConnection?: boolean }) {
  if (name === ':memory:' || options?.useNewConnection) name = undefined;
  const database = new DatabaseSync(name ? join(directory, name) : ':memory:');
  const adapter = {
    _database: database,
    closeAsync: async () => { database.close(); },
    execAsync: async (sql: string) => { database.exec(sql); },
    runAsync: async (sql: string, ...values: SQLInputValue[]) => {
      const result = database.prepare(sql).run(...values);
      return { ...result, lastInsertRowId: Number(result.lastInsertRowid) };
    },
    getAllAsync: async (sql: string, ...values: SQLInputValue[]) => database.prepare(sql).all(...values),
    getFirstAsync: async (sql: string, ...values: SQLInputValue[]) => database.prepare(sql).get(...values) ?? null,
    prepareAsync: async (sql: string) => {
      const statement = database.prepare(sql);
      return { executeAsync: async (...values: SQLInputValue[]) => statement.run(...values), finalizeAsync: async () => undefined };
    },
    withTransactionAsync: async (operation: () => Promise<void>) => {
      database.exec('BEGIN');
      try { await operation(); database.exec('COMMIT'); }
      catch (error) { database.exec('ROLLBACK'); throw error; }
    },
  };
  return adapter;
}

export async function backupDatabaseAsync({sourceDatabase, destDatabase}: {sourceDatabase: {_database: DatabaseSync}; destDatabase: {_database: DatabaseSync}}) {
  const source = sourceDatabase._database; const destination = destDatabase._database;
  destination.exec("PRAGMA foreign_keys=OFF");
  const tables = source.prepare("SELECT name,sql FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'").all() as {name:string;sql:string}[];
  const old = destination.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'").all() as {name:string}[];
  for (const table of old) destination.exec(`DROP TABLE "${table.name}"`);
  for (const table of tables) {
    destination.exec(table.sql);
    for (const row of source.prepare(`SELECT * FROM "${table.name}"`).all()) {
      const keys = Object.keys(row);
      destination.prepare(`INSERT INTO "${table.name}" (${keys.map(key => `"${key}"`).join(',')}) VALUES (${keys.map(() => '?').join(',')})`).run(...Object.values(row) as SQLInputValue[]);
    }
  }
  const indexes = source.prepare("SELECT sql FROM sqlite_master WHERE type='index' AND sql IS NOT NULL").all() as {sql:string}[];
  for (const index of indexes) destination.exec(index.sql);
  destination.exec("PRAGMA foreign_keys=ON");
}

export async function deleteDatabaseAsync(name: string) {
  rmSync(join(directory, name), { force: true });
}
