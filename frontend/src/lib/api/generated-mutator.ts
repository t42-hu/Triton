import { z } from 'zod'
import {
    PublicConfigSchema,
    UserProfileSchema,
    ProfileImageUploadResultSchema,
    NativeStartResponseSchema,
    NativeCallbackResponseSchema,
    NativeExchangeResponseSchema,
} from '@fullstack-starter/shared'
import { apiRequest } from './api-helper'
import { apiUrl } from './url'

// Preserve the app's credentials, timeout, error contract, and native token handling.
// Orval generates request paths and typed bodies; shared Zod validates responses
// at the feature boundary where clients consume them.
const responseSchemas: Record<string, z.ZodType> = {
    'GET /api/config': PublicConfigSchema,
    'GET /api/users/me': UserProfileSchema,
    'PATCH /api/users/me': UserProfileSchema,
    'POST /api/profile-images/optimize': ProfileImageUploadResultSchema,
    'POST /api/native-auth/start': NativeStartResponseSchema,
    'POST /api/native-auth/authorize': NativeCallbackResponseSchema,
    'POST /api/native-auth/exchange': NativeExchangeResponseSchema,
    'POST /api/native-auth/reset-handoff': NativeCallbackResponseSchema,
}

export function generatedApiRequest<T>(url: string, options: RequestInit): Promise<T> {
    const schema = responseSchemas[`${(options.method ?? 'GET').toUpperCase()} ${url}`] ?? z.unknown()
    return apiRequest(apiUrl(url), schema, options) as Promise<T>
}
