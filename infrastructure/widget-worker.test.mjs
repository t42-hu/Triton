import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { test } from 'node:test'
import { runInNewContext } from 'node:vm'

const script = await readFile(new URL('../frontend/universal/public/widget-sw.js', import.meta.url), 'utf8')

function host(supported = true) {
    const listeners = new Map(), storage = new Map(), rendered = []
    const cache = { put: async (url, value) => storage.set(url, value), match: async url => storage.get(url)?.clone(), delete: async url => storage.delete(url) }
    const self = {
        location: { origin: 'https://triton.example' },
        addEventListener: (name, callback) => listeners.set(name, callback),
        clients: { claim: async () => {}, matchAll: async () => [] },
        widgets: supported ? { getByTag: async () => ({}), updateByTag: async (_, payload) => rendered.push(JSON.parse(payload.data)) } : undefined,
    }
    runInNewContext(script, { self, URL, Response, Intl, Date, caches: { open: async () => cache, delete: async () => storage.clear() }, fetch: async () => new Response('{}') })
    async function send(data) {
        let complete
        listeners.get('message')({ data: { type: 'triton-widget', data }, source: { url: 'https://triton.example/' }, waitUntil: value => { complete = value } })
        await complete
    }
    return { send, rendered, storage, listeners }
}

test('Windows widget filters elapsed events and clears the stored snapshot on sign-out', async () => {
    const now = Date.now(), service = host()
    const event = { title: 'Current', time: '10:00–12:00', location: 'BA.101', start: now - 60000, end: now + 60000, allDay: false }
    await service.send({ updated: now, days: [{ label: 'Mai nap', start: now - 3600000, end: now + 3600000, events: [event, { ...event, title: 'Ended', end: now - 1 }] }] })
    assert.deepEqual(service.rendered.at(-1).events.map(event => event.title), ['Current'])
    assert.equal(service.storage.size, 1)
    await service.send({ updated: now, days: [] })
    assert.equal(service.storage.size, 0)
    assert.equal(service.rendered.at(-1).message, 'Nyisd meg a Triton42-t')
})

test('unsupported browsers never persist calendar snapshots or intercept requests', async () => {
    const service = host(false)
    await service.send({ days: [{ events: [] }] })
    assert.equal(service.storage.size, 0)
    assert.equal(service.listeners.has('fetch'), false)
})
