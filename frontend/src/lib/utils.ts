import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs))
}

export function getApiErrorMessage(error: unknown, fallbackMessage: string) {
    if (typeof error === 'string' && error.trim().length > 0) {
        return error
    }

    if (
        error &&
        typeof error === 'object' &&
        'message' in error &&
        typeof error.message === 'string' &&
        error.message.trim().length > 0
    ) {
        return error.message
    }

    return fallbackMessage
}
