import { Module } from '@nestjs/common'
import { DatabaseModule } from '../database/database.module.js'
import { StorageModule } from '../storage/storage.module.js'
import { VirusScannerModule } from '../virusscanner/virusscanner.module.js'
import {
    CalendarController,
    CalendarActionsController,
    CalendarFilesController,
    CalendarSyncController,
} from './calendar.controller.js'
import { CalendarService } from './calendar.service.js'
import { CalendarActions } from './calendar.actions.js'
import { CalendarFiles } from './calendar.files.js'
import { CalendarSync } from './calendar.sync.js'
import { CalendarSharing } from './calendar-sharing.js'
import { CalendarSharingController } from './calendar-sharing.controller.js'
@Module({
    imports: [DatabaseModule, StorageModule, VirusScannerModule],
    controllers: [CalendarSharingController, CalendarController, CalendarActionsController, CalendarFilesController, CalendarSyncController],
    providers: [CalendarSharing, CalendarService, CalendarActions, CalendarFiles, CalendarSync],
})
export class CalendarModule {}
