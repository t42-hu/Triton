import { Controller, Post, UseInterceptors } from '@nestjs/common'
import { Session, type UserSession } from '@thallesp/nestjs-better-auth'
import { CalendarPrivacyInterceptor } from './calendar.controller.js'
import { CalendarSubscriptions } from './calendar-subscriptions.js'
@Controller('calendar-subscriptions')
@UseInterceptors(CalendarPrivacyInterceptor)
export class CalendarSubscriptionsController {
    constructor(readonly subscriptions: CalendarSubscriptions) {}
    @Post('refresh') async refresh(@Session() session: UserSession) {
        const results = await this.subscriptions.refresh(session.user.id)
        return {
            status: results.some((row) => row.status === 'failed')
                ? 'failed'
                : results.some((row) => row.status === 'success')
                  ? 'success'
                  : 'skipped',
            results,
        }
    }
}
