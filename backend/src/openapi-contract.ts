import * as calendarContract from '@fullstack-starter/shared'
import {
    CalendarController,
    CalendarActionsController,
    CalendarSyncController,
    CalendarFilesController,
} from './calendar/calendar.controller.js'
import { CalendarService } from './calendar/calendar.service.js'
import { CalendarActions } from './calendar/calendar.actions.js'
import { CalendarSync } from './calendar/calendar.sync.js'
import { CalendarFiles } from './calendar/calendar.files.js'
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
        CalendarController,
        CalendarActionsController,
        CalendarSyncController,
        CalendarFilesController,
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
        CalendarService,
        CalendarActions,
        CalendarSync,
        CalendarFiles,
    ].map((provide) => ({ provide, useValue: {} })),
})
class ApiContractModule {}

// OpenAPI 3.0 does not support JSON Schema's recursive local definitions.
// Arbitrary nested JSON values remain unconstrained in the generated contract.
const schema = (value: z.ZodType, io: 'input' | 'output') => {
    const clean = (item: unknown): unknown => {
        if (Array.isArray(item)) return item.map(clean)
        if (item && typeof item === 'object') {
            const record = item as Record<string, unknown>
            if (typeof record.$ref === 'string' && record.$ref.startsWith('#/definitions/')) return {}
            return Object.fromEntries(
                Object.entries(record)
                    .filter(([key]) => key !== 'definitions')
                    .map(([key, child]) => [key, clean(child)]),
            )
        }
        return item
    }
    return clean(z.toJSONSchema(value, { target: 'openapi-3.0', io })) as Record<string, unknown>
}
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
        parameters?: object[]
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

const c = calendarContract
const record = c.CalendarRecordSchema
const records = z.object({ participants: z.array(record) })
const protectedResponse = (value: z.ZodType, code = 200) => ({
    [code]: response(value),
    400: problem,
    401: problem,
    403: problem,
    404: problem,
    409: problem,
})
const resourceParameter = {
    in: 'path',
    name: 'resource',
    required: true,
    schema: { type: 'string', enum: Object.keys(c.CalendarResourceSchemas) },
}
const idParameter = { in: 'path', name: 'id', required: true, schema: { type: 'string' } }
const queryParameters = (value: z.ZodType) => {
    const object = schema(value, 'input') as { properties: Record<string, object>; required?: string[] }
    return Object.entries(object.properties).map(([name, property]) => ({
        in: 'query',
        name,
        required: object.required?.includes(name) || false,
        schema: property,
    }))
}
const addOperation = (
    method: string,
    path: string,
    operationId: string,
    summary: string,
    output: z.ZodType,
    input?: z.ZodType,
    parameters?: object[],
    code = 200,
) => {
    operations[`${method} /api/${path}`] = {
        operationId,
        tags: ['calendar'],
        summary,
        security: [{ session: [] }, { nativeToken: [] }],
        responses: protectedResponse(output, code),
        ...(input ? { requestBody: { required: true, ...json(input, 'input') } } : {}),
        ...(parameters ? { parameters } : {}),
    }
}
const createBodies = z.union(Object.values(c.CalendarResourceSchemas))
const updateBodies = z.union(
    Object.values(c.CalendarResourceSchemas).map((value) =>
        (value as z.ZodObject<z.ZodRawShape>).partial().omit({ id: true }).extend({ version: c.CalendarVersionSchema }),
    ),
)
addOperation(
    'get',
    'calendar/{resource}',
    'listCalendarRecords',
    'List accessible records',
    c.CalendarListResponseSchema,
    undefined,
    [resourceParameter, ...queryParameters(c.CalendarListSchema)],
)
addOperation('get', 'calendar/{resource}/{id}', 'getCalendarRecord', 'Get an accessible record', record, undefined, [
    resourceParameter,
    idParameter,
])
addOperation(
    'post',
    'calendar/{resource}',
    'createCalendarRecord',
    'Create a record in the selected resource',
    record,
    createBodies,
    [resourceParameter],
    201,
)
addOperation(
    'patch',
    'calendar/{resource}/{id}',
    'updateCalendarRecord',
    'Update with the expected record version',
    record,
    updateBodies,
    [resourceParameter, idParameter],
)
addOperation(
    'delete',
    'calendar/{resource}/{id}',
    'deleteCalendarRecord',
    'Soft-delete with the expected record version',
    record,
    c.CalendarDeleteSchema,
    [resourceParameter, idParameter],
)
addOperation(
    'post',
    'calendar-actions/invitations',
    'inviteCalendarUser',
    'Invite a user to a calendar',
    record,
    c.CalendarInviteSchema,
    undefined,
    201,
)
addOperation(
    'post',
    'calendar-actions/invitations/{id}/respond',
    'respondCalendarInvitation',
    'Accept or decline your invitation',
    record,
    c.CalendarInviteResponseSchema,
    [idParameter],
    201,
)
addOperation(
    'post',
    'calendar-actions/meetings',
    'createMeeting',
    'Create an event, meeting and invitations atomically',
    z.object({ event: record, meeting: record, participants: z.array(record) }),
    c.MeetingCreateSchema,
    undefined,
    201,
)
addOperation(
    'post',
    'calendar-actions/meetings/{id}/invite',
    'inviteMeetingUsers',
    'Invite users to one meeting',
    records,
    c.MeetingInviteSchema,
    [idParameter],
    201,
)
addOperation(
    'post',
    'calendar-actions/meetings/{id}/respond',
    'respondMeeting',
    'Set your participation response',
    record,
    c.MeetingResponseSchema,
    [idParameter],
    201,
)
addOperation(
    'post',
    'calendar-actions/sources/{id}/publish',
    'publishCalendarImport',
    'Publish normalized imported events atomically',
    z.object({ source: record, revision: record, eventCount: z.number().int() }),
    c.ImportPublishSchema,
    [idParameter],
    201,
)
addOperation(
    'post',
    'sync/devices',
    'registerSyncDevice',
    'Register or reactivate this user installation',
    record,
    c.CalendarResourceSchemas.devices.omit({ id: true }),
    undefined,
    201,
)
addOperation(
    'get',
    'sync/snapshot',
    'getSyncSnapshot',
    'Read frozen authorized snapshot pages',
    z.object({
        snapshotToken: z.string(),
        highSequence: z.string(),
        items: z.array(z.object({ resource: c.CalendarResourceSchema, record })),
        nextOffset: z.number().int().nullable(),
        totalItems: z.number().int(),
    }),
    undefined,
    queryParameters(c.SyncSnapshotSchema),
)
addOperation(
    'get',
    'sync/pull',
    'pullSyncChanges',
    'Pull changes or request a replacement snapshot',
    z.object({
        requiresSnapshot: z.boolean(),
        changes: z.array(
            z.object({
                sequence: z.string(),
                resource: c.CalendarResourceSchema,
                id: z.string(),
                operation: z.enum(['upsert', 'delete']),
                record: record.nullable(),
            }),
        ),
        nextSequence: z.string(),
        highSequence: z.string(),
        hasMore: z.boolean(),
    }),
    undefined,
    queryParameters(c.SyncPullSchema),
)
addOperation(
    'post',
    'sync/push',
    'pushSyncMutations',
    'Apply an atomic idempotent mutation batch',
    c.SyncPushResponseSchema,
    c.SyncPushSchema,
    undefined,
    201,
)
addOperation(
    'post',
    'sync/ack',
    'acknowledgeSync',
    'Acknowledge a fully delivered snapshot or cursor',
    z.object({ sequence: z.string() }),
    c.SyncAckSchema,
    undefined,
    201,
)
addOperation(
    'get',
    'calendar-files/sources/{id}/content',
    'getCalendarSourceContent',
    'Read the current private source content as the calendar owner',
    z.object({ content: z.string().nullable() }),
    undefined,
    [idParameter],
)
addOperation(
    'post',
    'calendar-files/events/{id}',
    'uploadCalendarAttachment',
    'Upload a private event attachment (20 MiB limit)',
    record,
    undefined,
    [idParameter],
    201,
)
operations['post /api/calendar-files/events/{id}'].requestBody = {
    required: true,
    content: {
        'multipart/form-data': {
            schema: { type: 'object', required: ['file'], properties: { file: { type: 'string', format: 'binary' } } },
        },
    },
}
addOperation(
    'get',
    'calendar-files/attachments/{id}',
    'downloadCalendarAttachment',
    'Download a private attachment after checking event access',
    record,
    undefined,
    [idParameter],
)
operations['get /api/calendar-files/attachments/{id}'].responses[200] = {
    description: 'Private file download',
    content: { 'application/octet-stream': { schema: { type: 'string', format: 'binary' } } },
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
