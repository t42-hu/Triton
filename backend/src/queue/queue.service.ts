import { context, propagation, ROOT_CONTEXT, SpanKind, SpanStatusCode, trace } from '@opentelemetry/api'
import { Injectable, OnModuleDestroy } from '@nestjs/common'
import { Job, JobsOptions, Processor, Queue, QueueEvents, QueueOptions, Worker, WorkerOptions } from 'bullmq'
import type { Redis } from 'ioredis'
import { PinoLogger } from 'nestjs-pino'
import { CacheService } from '../cache/cache.service.js'
import { currentRequestId, runWithRequestContext } from '../observability/request-context.js'

type JobTelemetry = Record<string, string> & { requestId?: string }

function telemetryMetadata(existing?: string): string {
    let metadata: JobTelemetry = {}
    if (existing) {
        try {
            const parsed: unknown = JSON.parse(existing)
            if (parsed && typeof parsed === 'object') metadata = parsed as JobTelemetry
        } catch {
            // BullMQ telemetry metadata is opaque; keep invalid external values out.
        }
    }
    const requestId = currentRequestId()
    if (requestId) metadata.requestId = requestId
    propagation.inject(context.active(), metadata)
    return JSON.stringify(metadata)
}

function parseTelemetryMetadata(value?: string): JobTelemetry {
    if (!value) return {}
    try {
        const parsed: unknown = JSON.parse(value)
        return parsed && typeof parsed === 'object' ? (parsed as JobTelemetry) : {}
    } catch {
        return {}
    }
}

@Injectable()
export class QueueService implements OnModuleDestroy {
    private readonly queues = new Map<string, Queue>()
    private readonly workers = new Map<string, Worker>()
    private readonly workerConnections = new Map<string, Redis>()
    private readonly queueEvents = new Map<string, QueueEvents>()
    private readonly queueEventConnections = new Map<string, Redis>()

    constructor(
        private readonly cacheService: CacheService,
        private readonly logger: PinoLogger,
    ) {
        this.logger.setContext(QueueService.name)
    }

    getQueue(name: string, options?: Omit<QueueOptions, 'connection'>): Queue {
        const existing: Queue | undefined = this.queues.get(name)
        if (existing) {
            return existing
        }

        const queue: Queue = new Queue(name, {
            connection: this.cacheService.client,
            ...options,
            defaultJobOptions: {
                attempts: 5,
                backoff: { type: 'exponential', delay: 1000 },
                removeOnComplete: { age: 86400, count: 1000 },
                removeOnFail: { age: 604800, count: 5000 },
                ...options?.defaultJobOptions,
            },
        })

        queue.on('error', (error) => this.logger.error({ err: error, queue: name }, 'Queue connection error'))
        this.queues.set(name, queue)
        return queue
    }

    add<TData = unknown>(queueName: string, jobName: string, data: TData, options?: JobsOptions): Promise<Job> {
        const queue: Queue = this.getQueue(queueName)
        const job: Promise<Job> = queue.add(jobName, data, {
            ...options,
            telemetry: {
                ...options?.telemetry,
                metadata: telemetryMetadata(options?.telemetry?.metadata),
            },
        })
        return job
    }

    createWorker<TData = unknown, TResult = unknown>(
        queueName: string,
        processor: Processor<TData, TResult, string>,
        options?: Omit<WorkerOptions, 'connection'>,
    ): Worker {
        const existing: Worker | undefined = this.workers.get(queueName)
        if (existing) {
            return existing
        }

        const connection: Redis = this.cacheService.client.duplicate({
            maxRetriesPerRequest: null,
        })
        const tracedProcessor: Processor<TData, TResult, string> = async (job, token) => {
            const metadata = parseTelemetryMetadata(job.opts.telemetry?.metadata)
            const parent = propagation.extract(ROOT_CONTEXT, metadata)
            const tracer = trace.getTracer('fullstack-queue')
            return tracer.startActiveSpan(
                `queue ${queueName} ${job.name}`,
                {
                    kind: SpanKind.CONSUMER,
                    attributes: {
                        'messaging.system': 'bullmq',
                        'messaging.destination.name': queueName,
                        'messaging.operation.name': 'process',
                        'messaging.message.id': String(job.id || 'unknown'),
                    },
                },
                parent,
                async (span) => {
                    try {
                        const execute = () => processor(job, token)
                        return metadata.requestId
                            ? await runWithRequestContext({ requestId: metadata.requestId }, execute)
                            : await execute()
                    } catch (error) {
                        span.recordException(error instanceof Error ? error : new Error(String(error)))
                        span.setStatus({ code: SpanStatusCode.ERROR })
                        throw error
                    } finally {
                        span.end()
                    }
                },
            )
        }
        const worker: Worker = new Worker(queueName, tracedProcessor, {
            connection,
            ...options,
        })

        worker.on('failed', (job, error) =>
            this.logger.warn(
                {
                    err: error,
                    queue: queueName,
                    jobId: job?.id || 'unknown',
                    jobName: job?.name || 'unknown',
                    requestId: parseTelemetryMetadata(job?.opts.telemetry?.metadata).requestId,
                },
                'Queue job failed; inspect the retained failed job',
            ),
        )
        worker.on('error', (error) =>
            this.logger.error({ err: error, queue: queueName }, 'Queue worker connection error'),
        )
        this.workers.set(queueName, worker)
        this.workerConnections.set(queueName, connection)
        return worker
    }

    getQueueEvents(name: string) {
        const existing = this.queueEvents.get(name)
        if (existing) {
            return existing
        }

        const connection = this.cacheService.client.duplicate({
            maxRetriesPerRequest: null,
        })
        const events = new QueueEvents(name, {
            connection,
        })

        events.on('error', (error) => this.logger.error({ err: error, queue: name }, 'Queue event connection error'))
        this.queueEvents.set(name, events)
        this.queueEventConnections.set(name, connection)
        return events
    }

    async onModuleDestroy() {
        await Promise.all([
            ...Array.from(this.workers.values(), (worker) => worker.close()),
            ...Array.from(this.queueEvents.values(), (events) => events.close()),
            ...Array.from(this.queues.values(), (queue) => queue.close()),
        ])
        await Promise.all(
            [...this.workerConnections.values(), ...this.queueEventConnections.values()].map((connection) =>
                connection.quit(),
            ),
        )
    }
}
