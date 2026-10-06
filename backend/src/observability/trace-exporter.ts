import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http'

// Export only operational dimensions: automatic instrumentations can otherwise
// collect SQL, URL queries, credential-bearing paths, and exception messages.
const attributes = new Set([
    'http.method',
    'http.request.method',
    'http.status_code',
    'http.response.status_code',
    'db.system',
    'db.system.name',
    'messaging.system',
    'messaging.operation.name',
    'request.id',
])

export class PrivateTraceExporter extends OTLPTraceExporter {
    override export(
        spans: Parameters<OTLPTraceExporter['export']>[0],
        callback: Parameters<OTLPTraceExporter['export']>[1],
    ): void {
        super.export(
            spans.map((span) => ({
                ...span,
                spanContext: () => span.spanContext(),
                name: `${span.instrumentationScope.name} operation`,
                attributes: Object.fromEntries(Object.entries(span.attributes).filter(([key]) => attributes.has(key))),
                status: { code: span.status.code },
                events: [],
                links: span.links.map((link) => ({ context: link.context })),
            })),
            callback,
        )
    }
}
