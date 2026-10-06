import { Module } from '@nestjs/common'
import { DatabaseModule } from '../database/database.module.js'
import { ProfileImageModule } from '../profile-image/profile-image.module.js'
import { UserController } from './user.controller.js'
import { UserService } from './user.service.js'

@Module({
    imports: [DatabaseModule, ProfileImageModule],
    controllers: [UserController],
    providers: [UserService],
})
export class UserModule {}
