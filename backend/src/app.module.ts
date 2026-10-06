import { Module } from '@nestjs/common'
import { ConfigModule } from '@nestjs/config'
import { AuthModule } from '@thallesp/nestjs-better-auth'
import { LoggerModule } from 'nestjs-pino'
import { AppController } from './app.controller.js'
import { createAuth } from './auth/auth.js'
import { NativeAuthController } from './auth/native-auth.controller.js'
import { NativeAuthService } from './auth/native-auth.service.js'
import { CacheModule } from './cache/cache.module.js'
import { validateEnvironment } from './config/environment.js'
import { DatabaseModule } from './database/database.module.js'
import { DatabaseService } from './database/database.service.js'
import { MailModule } from './mail/mail.module.js'
import { MailService } from './mail/mail.service.js'
import { ApiExceptionFilter } from './observability/api-exception.filter.js'
import { createPinoHttpOptions } from './observability/logger.js'
import { TelemetryLifecycleService } from './observability/telemetry-lifecycle.service.js'
import { PaymentModule } from './payment/payment.module.js'
import { ProfileImageModule } from './profile-image/profile-image.module.js'
import { QueueModule } from './queue/queue.module.js'
import { RateLimitModule } from './rate-limit/rate-limit.module.js'
import { SearchModule } from './search/search.module.js'
import { StorageModule } from './storage/storage.module.js'
import { UserModule } from './user/user.module.js'
import { VirusScannerModule } from './virusscanner/virusscanner.module.js'

@Module({
    imports: [
        // Access logging is installed before Better Auth in bootstrap. The shared
        // AsyncLocalStorage mixin also correlates logs outside Nest's route pipeline.
        LoggerModule.forRoot({ pinoHttp: createPinoHttpOptions(), forRoutes: [] }),
        ConfigModule.forRoot({
            isGlobal: true,
            envFilePath: ['.env', '../.env'],
            validate: validateEnvironment,
        }),
        DatabaseModule,
        MailModule,
        AuthModule.forRootAsync({
            imports: [DatabaseModule, MailModule],
            inject: [DatabaseService, MailService],
            useFactory: (databaseService: DatabaseService, mailService: MailService) => ({
                auth: createAuth(databaseService, mailService),
                bodyParser: {
                    json: { limit: '2mb' },
                    urlencoded: { limit: '2mb', extended: true },
                    rawBody: true,
                },
            }),
        }),
        CacheModule,
        QueueModule,
        RateLimitModule,
        SearchModule,
        VirusScannerModule,
        StorageModule,
        ProfileImageModule,
        UserModule,
        PaymentModule,
    ],
    controllers: [AppController, NativeAuthController],
    providers: [NativeAuthService, ApiExceptionFilter, TelemetryLifecycleService],
})
export class AppModule {}
