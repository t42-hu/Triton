import { apiRequest } from '@/lib/api/api-helper'
import { apiUrl } from './url'
import { z } from 'zod'
type RequestPasswordResetBody = {
    email: string
    redirectTo: string
}

type ResetPasswordBody = {
    token: string
    newPassword: string
}

export function requestPasswordReset(body: RequestPasswordResetBody, captchaResponse?: string | null) {
    return apiRequest(apiUrl('/api/auth/request-password-reset'), z.unknown(), {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            ...(captchaResponse ? { 'x-captcha-response': captchaResponse } : {}),
        },
        body: JSON.stringify(body),
    })
}

export function resetPassword(body: ResetPasswordBody) {
    return apiRequest(apiUrl('/api/auth/reset-password'), z.unknown(), {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
    })
}
