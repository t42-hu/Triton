import { trustedOrigins } from '@fullstack-starter/shared'
import { NestFactory } from '@nestjs/core'
import { config } from 'dotenv'
import { Logger, PinoLogger } from 'nestjs-pino'
import { pinoHttp } from 'pino-http'
import { createPinoHttpOptions } from './observability/logger.js'
import { AppModule } from './app.module.js'
import { ApiExceptionFilter } from './observability/api-exception.filter.js'
import { requestContextMiddleware } from './observability/request-context.js'
import { RedisIoAdapter } from './redis-io.adapter.js'

config({ path: '../.env', quiet: true })

async function bootstrap() {
    // Better Auth needs the untouched request stream for its own handlers.
    // AuthModule installs body parsing for the remaining Nest routes.
    const app = await NestFactory.create(AppModule, {
        bodyParser: false,
        bufferLogs: true,
    })

    app.use(requestContextMiddleware)
    app.use(pinoHttp({ ...createPinoHttpOptions(), logger: PinoLogger.root }))
    app.useLogger(app.get(Logger))
    app.useGlobalFilters(app.get(ApiExceptionFilter))

    app.setGlobalPrefix('api')
    app.enableCors({
        origin: trustedOrigins(process.env),
        credentials: true,
        exposedHeaders: ['set-auth-token', 'x-request-id'],
    })
    app.enableShutdownHooks()

    const expressApp = app.getHttpAdapter().getInstance()
    expressApp.set(
        'trust proxy',
        process.env.TRUST_PROXY_CIDRS?.split(',')
            .map((value) => value.trim())
            .filter(Boolean) || false,
    )

    const cacheUrl = process.env.CACHE_URL
    if (!cacheUrl) {
        throw new Error('CACHE_URL is required')
    }

    const redisIoAdapter = new RedisIoAdapter(app, cacheUrl)
    await redisIoAdapter.connectToRedis()
    app.useWebSocketAdapter(redisIoAdapter)

    const port = Number(process.env.BACKEND_PORT ?? 4000)
    await app.listen(port, '0.0.0.0')
}

void bootstrap()
