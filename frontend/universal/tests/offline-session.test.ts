import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import { parseOfflineAccount, isConnectionFailure } from '../src/data/offline-account-model';
const user = { id: 'account', name: 'Fixture', email: 'fixture@example.test' };
function session(backend: () => Promise<unknown>, cached: typeof user | null) {
  const exports: Record<string, any> = {};
  const source = ts.transpileModule(readFileSync(new URL('../src/data/account-session.ts', import.meta.url), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
  vm.runInNewContext(source, { exports, require: (id: string) => ({ './backend': { backend }, './offline-account': { offlineAccount: async () => cached }, './offline-account-model': { isConnectionFailure } })[id] });
  return exports.restoreAccountSession;
}
test('a previously authenticated account opens offline; a new device cannot invent an offline login', async () => {
  const outage = Object.assign(new Error('Offline'), { status: 0 });
  assert.deepEqual((await session(async () => { throw outage; }, user)()).user, user);
  await assert.rejects(session(async () => { throw outage; }, null)(), error => error === outage);
});
test('expired, revoked or forbidden sessions never fall back to cached credentials', async () => {
  for (const status of [401, 403]) {
    const rejected = Object.assign(new Error('Rejected'), { status });
    await assert.rejects(session(async () => { throw rejected; }, user)(), error => error === rejected);
  }
  assert.equal(await session(async () => null, user)(), null);
});
test('offline identity parsing drops unneeded fields and rejects damaged storage', () => {
  assert.deepEqual(parseOfflineAccount(JSON.stringify({ ...user, token: 'never-copy', image: 'large' })), user);
  assert.equal(parseOfflineAccount('{'), null);
  assert.equal(parseOfflineAccount('{"id":1}'), null);
});
