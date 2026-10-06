import { StorageController } from './storage.controller.js'
import { Module } from '@nestjs/common'
import { StorageService } from './storage.service.js'

@Module({
    controllers: [StorageController],
    providers: [StorageService],
    exports: [StorageService],
})
export class StorageModule {}
