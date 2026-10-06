import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus, Injectable } from '@nestjs/common'
import type { Request, Response } from 'express'
import { PinoLogger } from 'nestjs-pino'
import { safeRequestPath } from './logger.js'
import { currentRequestId } from './request-context.js'

type ErrorResponse = {
    statusCode: number
    code: string
    message: string
    requestId: string
    details?: string[]
}

const statusCodes: Partial<Record<number, string>> = {
    [HttpStatus.BAD_REQUEST]: 'BAD_REQUEST',
    [HttpStatus.UNAUTHORIZED]: 'UNAUTHORIZED',
    [HttpStatus.FORBIDDEN]: 'FORBIDDEN',
    [HttpStatus.NOT_FOUND]: 'NOT_FOUND',
    [HttpStatus.CONFLICT]: 'CONFLICT',
    [HttpStatus.PAYLOAD_TOO_LARGE]: 'PAYLOAD_TOO_LARGE',
    [HttpStatus.TOO_MANY_REQUESTS]: 'RATE_LIMITED',
    [HttpStatus.INTERNAL_SERVER_ERROR]: 'INTERNAL_SERVER_ERROR',
    [HttpStatus.SERVICE_UNAVAILABLE]: 'SERVICE_UNAVAILABLE',
}

function publicError(exception: unknown): Omit<ErrorResponse, 'requestId'> {
    if (!(exception instanceof HttpException)) {
        return {
            statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
            code: 'INTERNAL_SERVER_ERROR',
            message: 'An unexpected error occurred',
        }
    }
    const statusCode = exception.getStatus()
    const response = exception.getResponse()
    const object = response && typeof response === 'object' ? (response as Record<string, unknown>) : undefined
    const messages = Array.isArray(object?.message)
        ? object.message.filter((value): value is string => typeof value === 'string')
        : undefined
    const message =
        statusCode === HttpStatus.INTERNAL_SERVER_ERROR
            ? 'An unexpected error occurred'
            : (messages?.length && 'Validation failed') ||
              (typeof object?.message === 'string' && object.message) ||
              (typeof response === 'string' && response) ||
              (statusCode >= 500 ? 'A service is unavailable' : exception.message)
    return {
        statusCode,
        code:
            (messages?.length && 'VALIDATION_ERROR') ||
            (typeof object?.code === 'string' && object.code) ||
            statusCodes[statusCode] ||
            'REQUEST_FAILED',
        message,
        ...(messages?.length ? { details: messages } : {}),
    }
}

@Injectable()
@Catch()
export class ApiExceptionFilter implements ExceptionFilter {
    constructor(private readonly logger: PinoLogger) {
        this.logger.setContext(ApiExceptionFilter.name)
    }

    catch(exception: unknown, host: ArgumentsHost): void {
        if (host.getType() !== 'http') throw exception
        const http = host.switchToHttp()
        const request = http.getRequest<Request & { id?: string }>()
        const response = http.getResponse<Response>()
        if (response.headersSent) return

        const requestId = request.id || currentRequestId() || 'unknown'
        const body: ErrorResponse = { ...publicError(exception), requestId }
        response.setHeader('x-request-id', requestId)

        if (body.statusCode >= 500) {
            this.logger.error(
                {
                    err: exception,
                    requestId,
                    method: request.method,
                    path: safeRequestPath(request.originalUrl || request.url),
                },
                'Unhandled request failure',
            )
        }
        response.status(body.statusCode).json(body)
    }
}
