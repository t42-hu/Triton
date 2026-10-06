import { ProfileImageUploadResultSchema } from '@fullstack-starter/shared'
import { parseApiResponse } from './api-helper'
import { uploadProfileImage as generatedUploadProfileImage } from './generated/client'

export async function uploadProfileImage(file: File) {
    return parseApiResponse(await generatedUploadProfileImage({ file }), ProfileImageUploadResultSchema)
}
