import { Injectable, OnModuleDestroy } from '@nestjs/common'
import { Redis } from 'ioredis'

@Injectable()
export class CacheService implements OnModuleDestroy {
    public readonly client: Redis

    constructor() {
        this.client = new Redis(process.env.CACHE_URL!)
    }

    get(key: string) {
        return this.client.get(key)
    }

    async set(key: string, value: string, ttlSeconds?: number) {
        if (ttlSeconds) {
            return this.client.set(key, value, 'EX', ttlSeconds)
        }
        return this.client.set(key, value)
    }

    async del(key: string) {
        return this.client.del(key)
    }

    async consumeRollingWindow(key: string, windowSeconds: number, limit: number) {
        const result = (await this.client.eval(
            `
      local time = redis.call('TIME')
      local now = (tonumber(time[1]) * 1000) + math.floor(tonumber(time[2]) / 1000)
      local window = tonumber(ARGV[1]) * 1000
      local limit = tonumber(ARGV[2])
      local member = tostring(now) .. ':' .. ARGV[3]
      local windowStart = now - window

      redis.call('ZREMRANGEBYSCORE', KEYS[1], 0, windowStart)

      local current = redis.call('ZCARD', KEYS[1])
      local allowed = 0

      if current < limit then
        redis.call('ZADD', KEYS[1], now, member)
        current = current + 1
        allowed = 1
      end

      redis.call('PEXPIRE', KEYS[1], window)

      local oldest = redis.call('ZRANGE', KEYS[1], 0, 0, 'WITHSCORES')
      local resetMs = window

      if oldest[2] then
        resetMs = math.max(0, tonumber(oldest[2]) + window - now)
      end

      return { allowed, current, math.ceil(resetMs / 1000) }
      `,
            1,
            key,
            windowSeconds.toString(),
            limit.toString(),
            crypto.randomUUID(),
        )) as [number, number, number]

        return {
            allowed: result[0] === 1,
            count: result[1],
            resetSeconds: result[2],
        }
    }

    async onModuleDestroy() {
        await this.client.quit()
    }
}
