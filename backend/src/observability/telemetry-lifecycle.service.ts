import { Injectable, type BeforeApplicationShutdown } from '@nestjs/common'
import { shutdownTelemetry } from './instrumentation.js'

@Injectable()
export class TelemetryLifecycleService implements BeforeApplicationShutdown {
    async beforeApplicationShutdown(): Promise<void> {
        await shutdownTelemetry()
    }
}
