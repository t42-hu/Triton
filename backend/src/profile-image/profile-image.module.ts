import { Module } from '@nestjs/common'
import { DatabaseModule } from '../database/database.module.js'
import { StorageModule } from '../storage/storage.module.js'
import { VirusScannerModule } from '../virusscanner/virusscanner.module.js'
import { ProfileImageController } from './profile-image.controller.js'
import { ProfileImageService } from './profile-image.service.js'

@Module({
    imports: [DatabaseModule, StorageModule, VirusScannerModule],
    controllers: [ProfileImageController],
    providers: [ProfileImageService],
    exports: [ProfileImageService],
})
export class ProfileImageModule {}
