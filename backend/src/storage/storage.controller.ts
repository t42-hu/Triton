import { Controller, Get, NotFoundException, Param, StreamableFile } from '@nestjs/common'
import { AllowAnonymous } from '@thallesp/nestjs-better-auth'
import { Readable } from 'node:stream'
import { StorageService } from './storage.service.js'

@Controller('files')
@AllowAnonymous()
export class StorageController {
    constructor(private readonly storage: StorageService) {}

    @Get('images/profile-images/:userId/:filename')
    async image(@Param('userId') userId: string, @Param('filename') filename: string) {
        if (
            process.env.NODE_ENV === 'production' ||
            process.env.STORAGE_AUTO_CREATE_BUCKET !== 'true' ||
            !/^[a-zA-Z0-9_-]+$/.test(userId) ||
            !/^[a-f0-9-]{36}\.webp$/.test(filename)
        )
            throw new NotFoundException()
        try {
            const object = await this.storage.getObject(`images/profile-images/${userId}/${filename}`)
            if (!(object.Body instanceof Readable)) throw new Error('Missing object stream')
            return new StreamableFile(object.Body, {
                type: 'image/webp',
                disposition: 'inline',
                length: object.ContentLength,
            })
        } catch {
            throw new NotFoundException()
        }
    }
}
