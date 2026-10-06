import { parseApiResponse } from './api-helper'
import {
    getCurrentUserProfile as generatedGetCurrentUserProfile,
    updateCurrentUserProfile as generatedUpdateCurrentUserProfile,
} from './generated/client'
import { UpdateUserProfileBodySchema, UserProfileSchema, type UpdateUserProfileBody } from '@fullstack-starter/shared'

export async function updateCurrentUserProfile(body: UpdateUserProfileBody) {
    const parsedBody = UpdateUserProfileBodySchema.safeParse(body)
    if (!parsedBody.success) throw new Error('Could not update profile.')
    return parseApiResponse(await generatedUpdateCurrentUserProfile(parsedBody.data), UserProfileSchema)
}

export async function getCurrentUserProfile() {
    return parseApiResponse(await generatedGetCurrentUserProfile(), UserProfileSchema)
}
