import { BadRequestException, Controller, Post, UploadedFile, UseInterceptors } from '@nestjs/common'
import { FileInterceptor } from '@nestjs/platform-express'
import { Session, type UserSession } from '@thallesp/nestjs-better-auth'
import { ProfileImageService } from './profile-image.service.js'

@Controller('profile-images')
export class ProfileImageController {
    constructor(private readonly profileImagesService: ProfileImageService) {}

    @Post('optimize')
    @UseInterceptors(
        FileInterceptor('file', {
            limits: { fileSize: 5 * 1024 * 1024, files: 1 },
        }),
    )
    optimizeAndUpload(@Session() session: UserSession, @UploadedFile() file?: Express.Multer.File) {
        if (!file) {
            throw new BadRequestException('Missing image')
        }

        return this.profileImagesService.optimizeAndUpload(session.user.id, file)
    }
}
