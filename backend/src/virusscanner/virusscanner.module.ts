import { Module } from '@nestjs/common'
import { VirusScannerService } from './virusscanner.service.js'

@Module({
    providers: [VirusScannerService],
    exports: [VirusScannerService],
})
export class VirusScannerModule {}
