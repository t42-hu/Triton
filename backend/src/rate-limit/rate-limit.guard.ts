import { CanActivate, ExecutionContext, HttpException, HttpStatus, Injectable } from '@nestjs/common'
import type { Request, Response } from 'express'
import { RateLimitService } from './rate-limit.service.js'

@Injectable()
export class RateLimitGuard implements CanActivate {
    constructor(private readonly rateLimitService: RateLimitService) {}

    async canActivate(context: ExecutionContext) {
        if (context.getType() !== 'http') {
            return true
        }

        const http = context.switchToHttp()
        const request = http.getRequest<Request>()
        const response = http.getResponse<Response>()
        if (request.method === 'GET' && request.path === '/api/health/live') return true
        const routePath = typeof request.route?.path === 'string' ? request.route.path : request.path
        const key = [
            'rate-limit',
            this.sanitizeKeyPart(request.ip || request.socket.remoteAddress || 'unknown'),
            request.method,
            this.sanitizeKeyPart(routePath || request.url),
        ].join(':')
        const result = await this.rateLimitService.consume(key)
        const remaining = Math.max(result.limit - result.count, 0)

        response.setHeader('X-RateLimit-Limit', result.limit.toString())
        response.setHeader('X-RateLimit-Remaining', remaining.toString())
        response.setHeader('X-RateLimit-Reset', result.resetSeconds.toString())

        if (!result.allowed) {
            response.setHeader('Retry-After', result.resetSeconds.toString())
            throw new HttpException('Rate limit exceeded', HttpStatus.TOO_MANY_REQUESTS)
        }

        return true
    }

    private sanitizeKeyPart(value: string) {
        return value.replace(/[^a-zA-Z0-9_.:-]/g, '_')
    }
}
