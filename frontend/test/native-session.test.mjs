import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import vm from 'node:vm'
import ts from 'typescript'

const compiled = ts.transpileModule(readFileSync(new URL('../src/lib/api/fetch.ts', import.meta.url), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText

async function sessionResponse(readBody, replaceToken) {
    let token = 'current-session'
    const exports = {}
    vm.runInNewContext(compiled, {
        exports,
        URL,
        Request,
        Headers,
        AbortSignal,
        Event,
        window: { dispatchEvent() {} },
        fetch: async () => ({
            ok: true,
            status: 200,
            headers: new Headers(),
            clone: () => ({
                json: async () => {
                    if (replaceToken) token = replaceToken
                    return readBody()
                },
            }),
        }),
        require: (path) =>
            path === './url'
                ? { apiUrl: () => 'https://example.test/api/' }
                : path === './errors'
                  ? { ApiError: Error }
                  : {
                        isNative: true,
                        sessionToken: async () => token,
                        setSessionToken: async (value) => {
                            token = value
                        },
                    },
    })
    await exports.apiFetch('https://example.test/api/auth/get-session')
    return token
}

test('cancelled and invalid session responses preserve secure native sessions', async () => {
    assert.equal(
        await sessionResponse(() => {
            throw new Error('Aborted body read')
        }),
        'current-session',
    )
    assert.equal(await sessionResponse(() => ({})), 'current-session')
    assert.equal(await sessionResponse(() => ({ session: { id: 'valid' } })), 'current-session')
})
test('only an explicit absent session clears its matching token', async () => {
    assert.equal(await sessionResponse(() => null), null)
    assert.equal(await sessionResponse(() => null, 'newer-session'), 'newer-session')
})
