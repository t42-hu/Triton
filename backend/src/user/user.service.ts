import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common'
import { eq } from 'drizzle-orm'
import type { UserProfile, UpdateUserProfileBody } from '@fullstack-starter/shared'
import { DatabaseService } from '../database/database.service.js'
import { user } from '../database/database.schema.js'
import { ProfileImageService } from '../profile-image/profile-image.service.js'

@Injectable()
export class UserService {
    constructor(
        private readonly databaseService: DatabaseService,
        private readonly profileImagesService: ProfileImageService,
    ) {}

    async getCurrentUser(userId: string): Promise<UserProfile> {
        const [currentUser] = await this.databaseService.db
            .select({
                id: user.id,
                name: user.name,
                profileImage: user.profileImage,
            })
            .from(user)
            .where(eq(user.id, userId))
            .limit(1)

        if (!currentUser) {
            throw new NotFoundException('User not found')
        }

        return currentUser
    }

    async updateCurrentUser(userId: string, body: UpdateUserProfileBody): Promise<UserProfile> {
        const [currentUser] = await this.databaseService.db
            .select({
                id: user.id,
                name: user.name,
                profileImage: user.profileImage,
            })
            .from(user)
            .where(eq(user.id, userId))
            .limit(1)

        if (!currentUser) {
            throw new NotFoundException('User not found')
        }

        const updates: {
            name?: string
            profileImage?: string | null
            updatedAt: Date
        } = {
            updatedAt: new Date(),
        }

        let hasChanges = false

        if (body.name !== undefined) {
            updates.name = body.name
            hasChanges = true
        }

        if (body.imageKey !== undefined) {
            updates.profileImage =
                body.imageKey === null ? null : await this.profileImagesService.processUpload(userId, body.imageKey)

            hasChanges = true
        }

        if (!hasChanges) {
            throw new BadRequestException('No profile changes provided')
        }

        await this.databaseService.db.update(user).set(updates).where(eq(user.id, userId))

        if ('profileImage' in updates && currentUser.profileImage !== updates.profileImage) {
            void this.profileImagesService.deleteByPublicUrl(currentUser.profileImage, userId)
        }

        return {
            id: currentUser.id,
            name: updates.name ?? currentUser.name,
            profileImage: 'profileImage' in updates ? (updates.profileImage ?? null) : currentUser.profileImage,
        }
    }
}
