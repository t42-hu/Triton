import assert from 'node:assert/strict';
import test from 'node:test';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { pathToFileURL } from 'node:url';

const require = createRequire(__filename);
const storageModule = pathToFileURL(join(dirname(require.resolve('expo-sqlite/package.json')), 'web/createStorageVFS.js')).href;
async function loadStorage() { return import(storageModule); }

test('available browser storage retains the persistent filesystem', async () => {
  const { createStorageVFS } = await loadStorage();
  const disk = {};
  assert.equal(await createStorageVFS(async () => disk, () => { throw new Error('Unexpected fallback'); }), disk);
});

test('private browsing storage refusal can open a temporary filesystem', async () => {
  const { createStorageVFS } = await loadStorage();
  for (const name of ['UnknownError', 'SecurityError', 'NotAllowedError', 'NotSupportedError']) {
    const memory = {};
    assert.equal(await createStorageVFS(async () => { throw new DOMException('Storage unavailable', name); }, async () => memory), memory);
  }
});

test('programming errors and failed memory initialization are reported', async () => {
  const { createStorageVFS } = await loadStorage();
  const failure = new Error('Broken initialization');
  await assert.rejects(createStorageVFS(async () => { throw failure; }, () => {}), error => error === failure);
  await assert.rejects(createStorageVFS(async () => { throw new DOMException('', 'UnknownError'); }, async () => { throw failure; }), error => error === failure);
});

test('temporary storage keeps account filenames isolated across close and reopen', async () => {
  const { createStorageVFS } = await loadStorage();
  const root = dirname(require.resolve('expo-sqlite/package.json'));
  const { MemoryVFS } = await import(pathToFileURL(join(root, 'web/wa-sqlite/MemoryVFS.js')).href);
  const { SQLITE_OPEN_CREATE, SQLITE_OPEN_READWRITE } = await import(pathToFileURL(join(root, 'web/wa-sqlite/sqlite-constants.js')).href);
  const vfs = await createStorageVFS(async () => { throw new DOMException('', 'UnknownError'); }, () => MemoryVFS.create('persistent-name', {}));
  const flags = SQLITE_OPEN_CREATE | SQLITE_OPEN_READWRITE;
  assert.equal(vfs.jOpen('first.db', 1, flags, new DataView(new ArrayBuffer(4))), 0);
  assert.equal(vfs.jOpen('second.db', 2, flags, new DataView(new ArrayBuffer(4))), 0);
  vfs.jWrite(1, new Uint8Array([42]), 0);
  vfs.jWrite(2, new Uint8Array([7]), 0);
  vfs.jClose(1);
  vfs.jOpen('first.db', 3, flags, new DataView(new ArrayBuffer(4)));
  const first = new Uint8Array(1), second = new Uint8Array(1);
  vfs.jRead(3, first, 0); vfs.jRead(2, second, 0);
  assert.deepEqual([...first], [42]); assert.deepEqual([...second], [7]);
  vfs.close();
});
