import 'reflect-metadata'
import assert from 'node:assert/strict'
import { CacheService } from '../../dist/cache/cache.service.js'
import { QueueService } from '../../dist/queue/queue.service.js'
import { currentRequestId, runWithRequestContext } from '../../dist/observability/request-context.js'
assert.ok(process.env.TEST_CACHE_URL, 'Set TEST_CACHE_URL to isolated test Redis')
process.env.CACHE_URL = process.env.TEST_CACHE_URL
const cache = new CacheService()
const logger = {
    setContext() {},
    error() {},
    warn() {},
}
const service = new QueueService(cache, logger)
const name = `integration-${Date.now()}`
let stopped = false
try {
    const queue = service.getQueue(name)
    const events = service.getQueueEvents(name)
    await events.waitUntilReady()
    let attempts = 0
    let finish
    let started
    const processing = new Promise((r) => {
        started = r
    })
    const release = new Promise((r) => {
        finish = r
    })
    const worker = service.createWorker(name, async (job) => {
        if (job.name === 'shutdown') {
            started()
            await release
            return 'drained'
        }
        assert.equal(currentRequestId(), 'queue-request-1')
        attempts++
        if (attempts < 3) throw new Error('transient test failure')
        return 'recovered'
    })
    await worker.waitUntilReady()
    const job = await runWithRequestContext({ requestId: 'queue-request-1' }, () =>
        service.add(name, 'retry', {}, { jobId: 'once' }),
    )
    const duplicate = await service.add(name, 'retry', {}, { jobId: 'once' })
    assert.equal(job.id, duplicate.id)
    assert.equal(await job.waitUntilFinished(events, 15000), 'recovered')
    assert.equal(attempts, 3)
    assert.equal(job.opts.attempts, 5)
    assert.equal(JSON.parse(job.opts.telemetry.metadata).requestId, 'queue-request-1')
    assert.deepEqual(job.opts.backoff, { type: 'exponential', delay: 1000 })
    assert.equal(await queue.getCompletedCount(), 1)
    console.log('PASS retry/backoff, retained completion, and explicit job-ID deduplication')
    const draining = await service.add(name, 'shutdown', {})
    await processing
    let closed = false
    const closing = service.onModuleDestroy().then(() => {
        closed = true
    })
    await new Promise((r) => setTimeout(r, 100))
    assert.equal(closed, false, 'Shutdown must wait for the active job')
    finish()
    await closing
    stopped = true
    const { Queue } = await import('bullmq')
    const inspect = new Queue(name, { connection: cache.client })
    assert.equal((await inspect.getJob(draining.id)).returnvalue, 'drained')
    await inspect.obliterate({ force: true })
    await inspect.close()
    console.log('PASS graceful shutdown drains active jobs')
} finally {
    if (!stopped) await service.onModuleDestroy()
    await cache.onModuleDestroy()
}
