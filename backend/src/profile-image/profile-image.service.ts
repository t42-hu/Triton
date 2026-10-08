import { BadRequestException, Injectable } from '@nestjs/common'
import { randomUUID } from 'node:crypto'
import sharp from 'sharp'
import { PinoLogger } from 'nestjs-pino'
import {
    ImageContentTypeSchema,
    PROFILE_IMAGE_MAX_DIMENSION,
    PROFILE_IMAGE_MAX_BYTES,
    type ProfileImageUploadResult,
} from '@fullstack-starter/shared'
import { StorageService } from '../storage/storage.service.js'
import { VirusScannerService } from '../virusscanner/virusscanner.service.js'
import { PROFILE_IMAGE_CACHE_CONTROL, PROFILE_IMAGE_KEY_PREFIX } from '../constants.js'

@Injectable()
export class ProfileImageService {
    constructor(
        private readonly storageService: StorageService,
        private readonly virusScannerService: VirusScannerService,
        private readonly logger: PinoLogger,
    ) {}

    async optimizeAndUpload(userId: string, file: Express.Multer.File): Promise<ProfileImageUploadResult> {
        if (!ImageContentTypeSchema.safeParse(file.mimetype).success) {
            throw new BadRequestException('Invalid image type')
        }

        if (process.env.VIRUS_SCAN_ENABLED === 'true') {
            const scan = await this.virusScannerService.scan(file.buffer)
            if (scan.status !== 'clean') throw new BadRequestException('The uploaded image is unsafe')
        }

        let optimized: Buffer
        try {
            optimized = await sharp(file.buffer)
                .rotate()
                .resize(PROFILE_IMAGE_MAX_DIMENSION, PROFILE_IMAGE_MAX_DIMENSION, {
                    fit: 'inside',
                    withoutEnlargement: true,
                })
                .webp({ quality: 82 })
                .toBuffer()
        } catch {
            throw new BadRequestException('Invalid image')
        }

        if (optimized.length > PROFILE_IMAGE_MAX_BYTES) {
            throw new BadRequestException('Profile image is too large')
        }

        const key = `${PROFILE_IMAGE_KEY_PREFIX}/${userId}/${randomUUID()}.webp`
        await this.storageService.putObject({
            key,
            body: optimized,
            contentType: 'image/webp',
            cacheControl: PROFILE_IMAGE_CACHE_CONTROL,
        })

        return {
            key,
            publicUrl: this.storageService.buildPublicUrl(key),
        }
    }

    async processUpload(userId: string, key: string): Promise<string> {
        const trimmedKey = key.trim()

        this.validateKey(userId, trimmedKey)

        await this.requireUploadedProfileImage(trimmedKey)

        return this.storageService.buildPublicUrl(trimmedKey)
    }

    async deleteByPublicUrl(publicUrl: string | null | undefined, userId: string): Promise<void> {
        if (!publicUrl) return

        try {
            const key = this.storageService.getKeyFromPublicUrl(publicUrl)

            if (!key?.startsWith(`${PROFILE_IMAGE_KEY_PREFIX}/${userId}/`)) return

            await this.storageService.deleteObject(key)
        } catch (error) {
            this.logger.warn({ err: error }, 'Profile image cleanup failed')
        }
    }

    private async requireUploadedProfileImage(key: string): Promise<void> {
        let metadata

        try {
            metadata = await this.storageService.getObjectMetadata(key)
        } catch {
            throw new BadRequestException('File was not uploaded')
        }

        const { contentType, contentLength } = metadata

        if (contentType !== 'image/webp') {
            await this.storageService.deleteObject(key)
            throw new BadRequestException('Invalid content type')
        }

        if (typeof contentLength !== 'number' || contentLength <= 0 || contentLength > PROFILE_IMAGE_MAX_BYTES) {
            await this.storageService.deleteObject(key)
            throw new BadRequestException('Profile image is too large')
        }
    }

    private validateKey(userId: string, key: string): void {
        if (!key.startsWith(`${PROFILE_IMAGE_KEY_PREFIX}/${userId}/`)) {
            throw new BadRequestException('Invalid key')
        }

        if (!key.endsWith('.webp')) {
            throw new BadRequestException('Invalid key')
        }
    }
}
