import { z } from 'zod'

export const UpdateUserProfileBodySchema = z.object({
    name: z.string().trim().min(2).max(50).optional(),
    imageKey: z.string().max(512).nullable().optional(),
})

export const UserProfileSchema = z.object({
    id: z.string(),
    name: z.string(),
    profileImage: z.string().nullable(),
})

export type UpdateUserProfileBody = z.infer<typeof UpdateUserProfileBodySchema>

export type UserProfile = z.infer<typeof UserProfileSchema>
