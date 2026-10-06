import { Injectable } from '@nestjs/common'
import { CacheService } from '../cache/cache.service.js'

@Injectable()
export class RateLimitService {
    constructor(private readonly cacheService: CacheService) {}

    async consume(key: string) {
        const state = await this.cacheService.consumeRollingWindow(
            key,
            Number(process.env.RATE_LIMIT_WINDOW_SECONDS || 60),
            Number(process.env.RATE_LIMIT_MAX_REQUESTS || 120),
        )

        return {
            ...state,
            limit: Number(process.env.RATE_LIMIT_MAX_REQUESTS || 120),
        }
    }
}
