import { z } from 'zod'

export const PROFILE_IMAGE_KEY_PREFIX = 'images/profile-images'
export const PROFILE_IMAGE_CACHE_CONTROL = 'public, max-age=31536000, immutable'
export const PROFILE_IMAGE_QUALITY = 0.82
export const PROFILE_IMAGE_MAX_BYTES = 1024 * 1024
export const PROFILE_IMAGE_MAX_DIMENSION = 512

export const ImageContentTypeSchema = z.enum(['image/jpeg', 'image/png', 'image/webp'])

export const ProfileImageUploadResultSchema = z.object({
    publicUrl: z.string(),
    key: z.string(),
})

export type ImageContentType = z.infer<typeof ImageContentTypeSchema>
export type ProfileImageUploadResult = z.infer<typeof ProfileImageUploadResultSchema>
