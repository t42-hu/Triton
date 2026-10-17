import assert from 'node:assert/strict';
import test from 'node:test';
import { getDatabase, onDatabaseWrite, saveSetting } from '../src/data/database';

test('cloud-restored JSON key ordering does not trigger another local write and sync loop', async () => {
  const db = await getDatabase();
  await db.runAsync('INSERT OR REPLACE INTO settings VALUES (?,?)', 'view', JSON.stringify({ theme: 'dark', nested: { b: 2, a: 1 } }));
  let writes = 0;
  const unsubscribe = onDatabaseWrite(() => { writes++; });
  try {
    await saveSetting('view', { nested: { a: 1, b: 2 }, theme: 'dark' });
    assert.equal(writes, 0);
    await saveSetting('view', { nested: { a: 1, b: 2 }, theme: 'light' });
    assert.equal(writes, 1);
  } finally { unsubscribe(); }
});
