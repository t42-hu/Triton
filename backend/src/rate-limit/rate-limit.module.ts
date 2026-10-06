import { Module } from '@nestjs/common'
import { APP_GUARD } from '@nestjs/core'
import { CacheModule } from '../cache/cache.module.js'
import { RateLimitGuard } from './rate-limit.guard.js'
import { RateLimitService } from './rate-limit.service.js'

@Module({
    imports: [CacheModule],
    providers: [
        RateLimitService,
        {
            provide: APP_GUARD,
            useClass: RateLimitGuard,
        },
    ],
    exports: [RateLimitService],
})
export class RateLimitModule {}
