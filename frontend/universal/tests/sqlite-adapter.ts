import { DatabaseSync, type SQLInputValue } from 'node:sqlite';

const namedDatabases = new Map<string, DatabaseSync>();

/** Runs production SQL against SQLite in memory; UI/browser tests cover the Expo adapter. */
export async function openDatabaseAsync(name?: string) {
  const database = name ? namedDatabases.get(name) ?? new DatabaseSync(':memory:') : new DatabaseSync(':memory:');
  if (name) namedDatabases.set(name, database);
  return {
    closeAsync: async () => undefined,
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
}

export async function deleteDatabaseAsync(name: string) {
  namedDatabases.get(name)?.close();
  namedDatabases.delete(name);
}
