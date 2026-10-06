import { ServiceUnavailableException, Injectable, OnModuleInit } from '@nestjs/common'
import {
    CreateBucketCommand,
    HeadBucketCommand,
    GetObjectCommand,
    DeleteObjectCommand,
    HeadObjectCommand,
    PutObjectCommand,
    S3Client,
} from '@aws-sdk/client-s3'

export type ObjectMetadata = {
    contentType?: string
    contentLength?: number
}

export type PutObjectOptions = {
    key: string
    body: Buffer
    contentType: string
    cacheControl?: string
}

@Injectable()
export class StorageService implements OnModuleInit {
    async onModuleInit() {
        if (process.env.STORAGE_AUTO_CREATE_BUCKET !== 'true') return
        if (process.env.NODE_ENV === 'production')
            throw new Error('Automatic bucket creation is restricted to development')
        const Bucket = this.getStorageConfig().bucket
        try {
            await this.getClient().send(new HeadBucketCommand({ Bucket }))
        } catch (error) {
            if ((error as { $metadata?: { httpStatusCode?: number } }).$metadata?.httpStatusCode !== 404) throw error
            await this.getClient().send(new CreateBucketCommand({ Bucket }))
        }
    }

    getObject(key: string) {
        return this.getClient().send(
            new GetObjectCommand({
                Bucket: this.getStorageConfig().bucket,
                Key: key,
            }),
        )
    }

    private s3Client?: S3Client

    async getObjectMetadata(key: string): Promise<ObjectMetadata> {
        const { bucket } = this.getStorageConfig()
        const response = await this.getClient().send(
            new HeadObjectCommand({
                Bucket: bucket,
                Key: key,
            }),
        )

        return {
            contentType: response.ContentType,
            contentLength: response.ContentLength,
        }
    }

    async putObject({ key, body, contentType, cacheControl }: PutObjectOptions): Promise<void> {
        const { bucket } = this.getStorageConfig()
        await this.getClient().send(
            new PutObjectCommand({
                Bucket: bucket,
                Key: key,
                Body: body,
                ContentType: contentType,
                CacheControl: cacheControl,
            }),
        )
    }

    async deleteObject(key: string): Promise<void> {
        const { bucket } = this.getStorageConfig()
        await this.getClient().send(
            new DeleteObjectCommand({
                Bucket: bucket,
                Key: key,
            }),
        )
    }

    buildPublicUrl(key: string): string {
        const publicBaseUrl = this.getPublicBaseUrl()
        const trimmed = publicBaseUrl.replace(/\/+$/, '')
        return `${trimmed}/${key}`
    }

    getKeyFromPublicUrl(publicUrl: string): string | null {
        const baseUrl = this.getPublicBaseUrl().replace(/\/+$/, '')

        if (!publicUrl.startsWith(`${baseUrl}/`)) {
            return null
        }

        return publicUrl.substring(baseUrl.length + 1)
    }

    private getClient(): S3Client {
        if (!this.s3Client) {
            const { endpoint, accessKeyId, secretAccessKey, region } = this.getStorageConfig()
            this.s3Client = new S3Client({
                endpoint,
                forcePathStyle: process.env.R2_FORCE_PATH_STYLE === 'true',
                region,
                credentials: {
                    accessKeyId,
                    secretAccessKey,
                },
            })
        }

        return this.s3Client
    }

    private getStorageConfig() {
        const endpoint = process.env.R2_ENDPOINT
        const region = process.env.R2_REGION || 'auto'
        const accessKeyId = process.env.R2_ACCESS_KEY_ID
        const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY
        const bucket = process.env.R2_BUCKET

        if (!endpoint || !region || !accessKeyId || !secretAccessKey || !bucket) {
            throw new ServiceUnavailableException('R2 is not configured')
        }

        return {
            endpoint,
            region,
            accessKeyId,
            secretAccessKey,
            bucket,
        }
    }

    private getPublicBaseUrl(): string {
        const publicBaseUrl = process.env.R2_PUBLIC_URL

        if (!publicBaseUrl) {
            throw new ServiceUnavailableException('R2 public URL is not configured')
        }

        return publicBaseUrl
    }
}
