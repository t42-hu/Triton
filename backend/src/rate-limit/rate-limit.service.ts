import { Injectable, Logger } from '@nestjs/common'
import { CacheService } from '../cache/cache.service.js'

@Injectable()
export class RateLimitService {
    private readonly fallback = new Map<string, { count: number; expires: number }>()
    private readonly logger = new Logger(RateLimitService.name)
    private warnedAt = 0
    private calendarCircuitUntil = 0
    constructor(private readonly cacheService: CacheService) {}

    async consume(key: string, allowCalendarFallback = false) {
        if (allowCalendarFallback && Date.now() < this.calendarCircuitUntil) return this.consumeFallback(key)
        try {
            return await this.consumeRedis(key)
        } catch (error) {
            if (!allowCalendarFallback) throw error
            this.calendarCircuitUntil = Date.now() + 15000
            return this.consumeFallback(key)
        }
    }
    private consumeFallback(key: string) {
        const now = Date.now(),
            window = Number(process.env.RATE_LIMIT_WINDOW_SECONDS || 60),
            limit = Number(process.env.RATE_LIMIT_MAX_REQUESTS || 120)
        for (const [entry, state] of this.fallback) if (state.expires <= now) this.fallback.delete(entry)
        if (!this.fallback.has(key) && this.fallback.size >= 10000)
            return { allowed: false, count: limit, limit, resetSeconds: window }
        const state = this.fallback.get(key) || { count: 0, expires: now + window * 1000 }
        state.count++
        this.fallback.set(key, state)
        if (now - this.warnedAt > 60000) {
            this.logger.warn('Redis rate limiter unavailable; bounded calendar-download fallback active')
            this.warnedAt = now
        }
        return {
            allowed: state.count <= limit,
            count: state.count,
            limit,
            resetSeconds: Math.ceil((state.expires - now) / 1000),
        }
    }
    private async consumeRedis(key: string) {
        let timer: ReturnType<typeof setTimeout> | undefined
        const operation = this.cacheService.consumeRollingWindow(
            key,
            Number(process.env.RATE_LIMIT_WINDOW_SECONDS || 60),
            Number(process.env.RATE_LIMIT_MAX_REQUESTS || 120),
        )
        const state = await Promise.race([
            operation,
            new Promise<never>((_, reject) => {
                timer = setTimeout(() => reject(new Error('Rate limiter timeout')), 1500)
            }),
        ]).finally(() => {
            if (timer) clearTimeout(timer)
        })

        return {
            ...state,
            limit: Number(process.env.RATE_LIMIT_MAX_REQUESTS || 120),
        }
    }
}
