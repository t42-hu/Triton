import { Module } from '@nestjs/common'
import { NestFactory } from '@nestjs/core'
import { DocumentBuilder, SwaggerModule, type OpenAPIObject } from '@nestjs/swagger'
import {
    CheckoutSessionSchema,
    NativeExchangeSchema,
    NativeExchangeResponseSchema,
    NativeCallbackResponseSchema,
    NativeStartResponseSchema,
    NativeStartSchema,
    ProfileImageUploadResultSchema,
    PublicConfigSchema,
    UpdateUserProfileBodySchema,
    UserProfileSchema,
} from '@fullstack-starter/shared'
import { z } from 'zod'
import { AppController } from './app.controller.js'
import { NativeAuthController } from './auth/native-auth.controller.js'
import { NativeAuthService } from './auth/native-auth.service.js'
import { CacheService } from './cache/cache.service.js'
import { DatabaseService } from './database/database.service.js'
import { PaymentController } from './payment/payment.controller.js'
import { PaymentService } from './payment/payment.service.js'
import { ProfileImageController } from './profile-image/profile-image.controller.js'
import { ProfileImageService } from './profile-image/profile-image.service.js'
import { SearchService } from './search/search.service.js'
import { StorageController } from './storage/storage.controller.js'
import { StorageService } from './storage/storage.service.js'
import { UserController } from './user/user.controller.js'
import { UserService } from './user/user.service.js'
import { VirusScannerService } from './virusscanner/virusscanner.service.js'

// Metadata only: no provider connects to the database, Redis, or external APIs.
@Module({
    controllers: [
        AppController,
        NativeAuthController,
        UserController,
        ProfileImageController,
        PaymentController,
        StorageController,
    ],
    providers: [
        DatabaseService,
        CacheService,
        SearchService,
        VirusScannerService,
        NativeAuthService,
        UserService,
        ProfileImageService,
        PaymentService,
        StorageService,
    ].map((provide) => ({ provide, useValue: {} })),
})
class ApiContractModule {}

const schema = (value: z.ZodType, io: 'input' | 'output') => z.toJSONSchema(value, { target: 'openapi-3.0', io })
const json = (value: z.ZodType, io: 'input' | 'output' = 'output') => ({
    content: { 'application/json': { schema: schema(value, io) } },
})
const response = (value: z.ZodType, description = 'Successful response') => ({
    description,
    ...json(value),
})
const problem = {
    description: 'Stable API error with a request ID',
    ...json(
        z.object({
            statusCode: z.number().int(),
            code: z.string(),
            message: z.string(),
            requestId: z.string(),
            details: z.array(z.string()).optional(),
        }),
    ),
}
const checkoutResponse = z.object({ id: z.string(), url: z.url().nullable() })

const operations: Record<
    string,
    {
        operationId: string
        tags: string[]
        summary: string
        requestBody?: object
        responses: Record<string, object>
        security?: object[]
    }
> = {
    'get /api/health': {
        operationId: 'getHealth',
        tags: ['health'],
        summary: 'Check required services',
        responses: {
            200: response(z.object({ status: z.literal('ok') })),
            503: problem,
        },
    },
    'get /api/health/live': {
        operationId: 'getLiveness',
        tags: ['health'],
        summary: 'Check process liveness',
        responses: { 200: response(z.object({ status: z.literal('ok') })) },
    },
    'get /api/config': {
        operationId: 'getPublicConfig',
        tags: ['config'],
        summary: 'Read public feature configuration',
        responses: { 200: response(PublicConfigSchema) },
    },
    'get /api/users/me': {
        operationId: 'getCurrentUserProfile',
        tags: ['users'],
        summary: 'Get current user profile',
        security: [{ session: [] }, { nativeToken: [] }],
        responses: { 200: response(UserProfileSchema), 401: problem },
    },
    'patch /api/users/me': {
        operationId: 'updateCurrentUserProfile',
        tags: ['users'],
        summary: 'Update current user profile',
        security: [{ session: [] }, { nativeToken: [] }],
        requestBody: {
            required: true,
            ...json(UpdateUserProfileBodySchema, 'input'),
        },
        responses: { 200: response(UserProfileSchema), 400: problem, 401: problem },
    },
    'post /api/profile-images/optimize': {
        operationId: 'uploadProfileImage',
        tags: ['profile-images'],
        summary: 'Optimize and upload a profile image',
        security: [{ session: [] }, { nativeToken: [] }],
        requestBody: {
            required: true,
            content: {
                'multipart/form-data': {
                    schema: {
                        type: 'object',
                        required: ['file'],
                        properties: { file: { type: 'string', format: 'binary' } },
                    },
                },
            },
        },
        responses: {
            201: response(ProfileImageUploadResultSchema),
            400: problem,
            401: problem,
        },
    },
    'post /api/payments/checkout/sessions': {
        operationId: 'createCheckoutSession',
        tags: ['payments'],
        summary: 'Create a Stripe checkout session',
        security: [{ session: [] }, { nativeToken: [] }],
        requestBody: { required: true, ...json(CheckoutSessionSchema, 'input') },
        responses: { 201: response(checkoutResponse), 400: problem, 401: problem },
    },
    'post /api/payments/webhooks/stripe': {
        operationId: 'handleStripeWebhook',
        tags: ['payments'],
        summary: 'Receive a signed Stripe webhook',
        requestBody: {
            required: true,
            content: {
                'application/json': {
                    schema: { type: 'object', additionalProperties: true },
                },
            },
        },
        responses: {
            201: response(z.object({ received: z.literal(true) })),
            400: problem,
        },
    },
    'post /api/native-auth/start': {
        operationId: 'startNativeAuth',
        tags: ['native-auth'],
        summary: 'Begin native sign-in or password reset',
        requestBody: { required: true, ...json(NativeStartSchema, 'input') },
        responses: { 201: response(NativeStartResponseSchema), 400: problem },
    },
    'post /api/native-auth/authorize': {
        operationId: 'authorizeNativeAuth',
        tags: ['native-auth'],
        summary: 'Approve native sign-in from a browser session',
        security: [{ session: [] }, { nativeToken: [] }],
        requestBody: {
            required: true,
            ...json(z.object({ flow: z.string() }), 'input'),
        },
        responses: {
            201: response(NativeCallbackResponseSchema),
            400: problem,
            401: problem,
        },
    },
    'post /api/native-auth/exchange': {
        operationId: 'exchangeNativeAuth',
        tags: ['native-auth'],
        summary: 'Exchange a native authorization code',
        requestBody: { required: true, ...json(NativeExchangeSchema, 'input') },
        responses: { 201: response(NativeExchangeResponseSchema), 400: problem },
    },
    'post /api/native-auth/reset-handoff': {
        operationId: 'resetNativeAuth',
        tags: ['native-auth'],
        summary: 'Hand off a password reset to a native app',
        requestBody: {
            required: true,
            ...json(z.object({ flow: z.string(), token: z.string() }), 'input'),
        },
        responses: { 201: response(NativeCallbackResponseSchema), 400: problem },
    },
    'get /api/files/images/profile-images/{userId}/{filename}': {
        operationId: 'getLocalProfileImage',
        tags: ['files'],
        summary: 'Read a local development profile image',
        responses: {
            200: {
                description: 'WebP image',
                content: {
                    'image/webp': { schema: { type: 'string', format: 'binary' } },
                },
            },
            404: problem,
        },
    },
}

export async function createApiContract(): Promise<OpenAPIObject> {
    const app = await NestFactory.create(ApiContractModule, { logger: false })
    try {
        app.setGlobalPrefix('api')
        const document = SwaggerModule.createDocument(
            app,
            new DocumentBuilder()
                .setTitle('Fullstack application API')
                .setVersion('1.0.0')
                .addCookieAuth(
                    'better-auth.session_token',
                    { type: 'apiKey', in: 'cookie', name: 'better-auth.session_token' },
                    'session',
                )
                .addBearerAuth(undefined, 'nativeToken')
                .build(),
        )
        const found = new Set<string>()
        for (const [path, methods] of Object.entries(document.paths)) {
            for (const [method, operation] of Object.entries(methods ?? {})) {
                const key = `${method} ${path}`
                const definition = operations[key]
                if (!definition) throw new Error(`Undocumented application route: ${key}`)
                Object.assign(operation, definition)
                found.add(key)
            }
        }
        for (const key of Object.keys(operations)) {
            if (!found.has(key)) throw new Error(`OpenAPI route no longer exists: ${key}`)
        }
        // Public auth routes belong to Better Auth, whose protocol is documented separately.
        document.components ??= {}
        document.components.securitySchemes = {
            session: {
                type: 'apiKey',
                in: 'cookie',
                name: 'better-auth.session_token',
                description: 'Browser session; native clients use bearer tokens.',
            },
            nativeToken: {
                type: 'http',
                scheme: 'bearer',
                description: 'Native secure-storage session token.',
            },
        }
        return document
    } finally {
        await app.close()
    }
}
