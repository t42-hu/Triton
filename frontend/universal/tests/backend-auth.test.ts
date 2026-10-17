import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

function fixture(platform = 'android') {
  let token: string | null = null, challenge: string | null = null;
  const requests: RequestInit[] = [];
  const storage = { sessionToken: async () => token, setSessionToken: async (v: string | null) => { token = v; }, pendingChallenge: async () => challenge, setPendingChallenge: async (v: string | null) => { challenge = v; } };
  function load() {
    const exports: Record<string, any> = {};
    const source = ts.transpileModule(readFileSync(new URL('../src/data/backend.ts', import.meta.url), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
    vm.runInNewContext(source, { exports, require: (id: string) => id === 'react-native' ? { Platform: { OS: platform } } : storage, process: { env: { EXPO_PUBLIC_API_URL: 'https://mobile.triton42.hu/api' } }, AbortController, FormData, URL, setTimeout, clearTimeout,
      fetch: async (_url: string, init: RequestInit) => {
        requests.push(init);
        const path = new URL(_url, 'https://web.example').pathname;
        if (path.endsWith('/sign-in/email')) return Response.json({ twoFactorRedirect: true }, { headers: { 'set-cookie': 'triton.two_factor=proof.signature; HttpOnly; Secure; Max-Age=600' } });
        if (path.endsWith('/status')) {
          const headers = new Headers(init.headers);
          if (!headers.get('Origin')) return Response.json({ message: 'Missing or null Origin' }, { status: 403 });
          assert.equal(headers.get('Origin'), 'https://mobile.triton42.hu');
          assert.equal(headers.get('Cookie'), 'triton.two_factor=proof.signature');
          return Response.json({ pending: false }, { headers: { 'set-auth-token': 'signed-session' } });
        }
        return Response.json({ ok: true });
      },
    });
    return exports;
  }
  return { load, requests, storage, values: () => ({ token, challenge }) };
}

test('native email approval sends trusted Origin with its cookie and survives app restart', async () => {
  const f = fixture();
  await f.load().backend('/auth/sign-in/email', 'POST', { email: 'fixture@example.test', password: 'fixture-only-password' });
  assert.equal(f.values().challenge, 'triton.two_factor=proof.signature');
  const restartedApp = f.load();
  assert.equal((await restartedApp.backend('/auth/two-factor/email/status', 'POST', {})).pending, false);
  assert.equal(f.values().token, 'signed-session');
  assert.equal(f.values().challenge, null);
  await restartedApp.backend('/auth/get-session');
  assert.equal(new Headers(f.requests.at(-1)?.headers).get('Authorization'), 'Bearer signed-session');
});

test('web transport leaves Origin and cookies to the browser', async () => {
  const f = fixture('web');
  await f.load().backend('/auth/get-session');
  const request = f.requests[0], headers = new Headers(request.headers);
  assert.equal(request.credentials, 'include');
  assert.equal(headers.has('Origin'), false);
  assert.equal(headers.has('Cookie'), false);
  assert.equal(headers.has('Authorization'), false);
});

test('cancelling clears the persisted native challenge', async () => {
  const f = fixture();
  await f.storage.setPendingChallenge('saved-proof');
  await f.load().clearChallenge();
  assert.equal(f.values().challenge, null);
});

test('native challenge storage expires after ten minutes and clears damaged data', async () => {
  const saved = new Map<string, string>();
  let now = 1000;
  const exports: Record<string, any> = {};
  const source = ts.transpileModule(readFileSync(new URL('../src/data/session-token.ts', import.meta.url), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  vm.runInNewContext(source, { exports, Date: { now: () => now }, require: () => ({
    getItemAsync: async (key: string) => saved.get(key) ?? null,
    setItemAsync: async (key: string, value: string) => { saved.set(key, value); },
    deleteItemAsync: async (key: string) => { saved.delete(key); },
  }) });
  await exports.setPendingChallenge('proof');
  assert.equal(await exports.pendingChallenge(), 'proof');
  now += 600000;
  assert.equal(await exports.pendingChallenge(), null);
  assert.equal(saved.size, 0);
  saved.set('triton42.email-challenge', 'invalid-json');
  assert.equal(await exports.pendingChallenge(), null);
  assert.equal(saved.size, 0);
});
