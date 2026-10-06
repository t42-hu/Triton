import { BadRequestException, Body, Controller, Get, Patch } from '@nestjs/common'
import { Session, type UserSession } from '@thallesp/nestjs-better-auth'
import { UpdateUserProfileBodySchema, type UpdateUserProfileBody, type UserProfile } from '@fullstack-starter/shared'
import { UserService } from './user.service.js'

@Controller('users')
export class UserController {
    constructor(private readonly usersService: UserService) {}

    @Get('me')
    async getMe(@Session() session: UserSession): Promise<UserProfile> {
        return this.usersService.getCurrentUser(session.user.id)
    }

    @Patch('me')
    async updateMe(@Session() session: UserSession, @Body() body: UpdateUserProfileBody) {
        const parsed = UpdateUserProfileBodySchema.safeParse(body)
        if (!parsed.success) {
            throw new BadRequestException('Invalid profile update')
        }

        return this.usersService.updateCurrentUser(session.user.id, parsed.data)
    }
}
