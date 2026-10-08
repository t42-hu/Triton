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
@Module({
    imports: [DatabaseModule, StorageModule, VirusScannerModule],
    controllers: [CalendarController, CalendarActionsController, CalendarFilesController, CalendarSyncController],
    providers: [CalendarService, CalendarActions, CalendarFiles, CalendarSync],
})
export class CalendarModule {}
