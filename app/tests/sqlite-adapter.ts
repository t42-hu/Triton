import { DatabaseSync, type SQLInputValue } from 'node:sqlite';

/** Runs production SQL against SQLite in memory; UI/browser tests cover the Expo adapter. */
export async function openDatabaseAsync() {
  const database = new DatabaseSync(':memory:');
  return {
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
