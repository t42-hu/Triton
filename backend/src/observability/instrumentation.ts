import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node'
import { PrivateTraceExporter } from './trace-exporter.js'
import { NodeSDK } from '@opentelemetry/sdk-node'
import { config } from 'dotenv'
import { register, syncBuiltinESMExports } from 'node:module'

config({ path: '../.env', quiet: true })

let sdk: NodeSDK | undefined

if (process.env.OTEL_ENABLED === 'true') {
    register('@opentelemetry/instrumentation/hook.mjs', import.meta.url)
    sdk = new NodeSDK({
        serviceName: process.env.OTEL_SERVICE_NAME || `${process.env.APP_ID || 'fullstack'}-backend`,
        traceExporter: new PrivateTraceExporter(),
        autoDetectResources: false,
        logRecordProcessors: [],
        metricReaders: [],
        instrumentations: [
            getNodeAutoInstrumentations({
                '@opentelemetry/instrumentation-fs': { enabled: false },
                '@opentelemetry/instrumentation-http': {
                    ignoreIncomingRequestHook: (request) => request.url === '/api/health/live',
                },
            }),
        ],
    })
    sdk.start()
    syncBuiltinESMExports()
}

export async function shutdownTelemetry(): Promise<void> {
    await sdk?.shutdown()
}
