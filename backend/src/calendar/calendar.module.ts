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
import { CalendarSubscriptionHealth } from './calendar-subscription-health.js'
import { CalendarSubscriptionsController } from './calendar-subscriptions.controller.js'
import { CalendarSubscriptions } from './calendar-subscriptions.js'
import { CalendarDownload } from './calendar-download.js'
import { CalendarSharingController } from './calendar-sharing.controller.js'
@Module({
    imports: [DatabaseModule, StorageModule, VirusScannerModule],
    controllers: [CalendarSubscriptionsController, CalendarSharingController, CalendarController, CalendarActionsController, CalendarFilesController, CalendarSyncController],
    providers: [CalendarSubscriptionHealth, CalendarSubscriptions, CalendarDownload, CalendarSharing, CalendarService, CalendarActions, CalendarFiles, CalendarSync],
})
export class CalendarModule {}
