import { Body, Controller, Delete, Get, Header, Param, Post, Res, UseInterceptors } from '@nestjs/common'
import { AllowAnonymous, Session, type UserSession } from '@thallesp/nestjs-better-auth'
import type { Response } from 'express'
import { z } from 'zod'
import { CalendarPrivacyInterceptor } from './calendar.controller.js'
import { CalendarSharing } from './calendar-sharing.js'
import { parse } from './calendar.service.js'

@UseInterceptors(CalendarPrivacyInterceptor)
@Controller('calendar-share')
export class CalendarSharingController {
    constructor(readonly sharing: CalendarSharing) {}
    @Get() list(@Session() session: UserSession) { return this.sharing.list(session.user.id) }
    @Get('options') options(@Session() session: UserSession) { return this.sharing.options(session.user.id) }
    @Post() create(@Session() session: UserSession, @Body() body: unknown) { return this.sharing.create(session.user.id, body) }
    @Delete(':id') revoke(@Session() session: UserSession, @Param('id') id: string) { return this.sharing.revoke(session.user.id, parse(z.uuid(), id)) }
    @AllowAnonymous()
    @Get(':id/:token/calendar.ics')
    @Header('Content-Type', 'text/calendar; charset=utf-8')
    @Header('Content-Disposition', 'attachment; filename="triton42.ics"')
    @Header('X-Content-Type-Options', 'nosniff')
    @Header('Referrer-Policy', 'no-referrer')
    async download(@Param('id') id: string, @Param('token') token: string, @Res() response: Response) {
        const content = await this.sharing.download(parse(z.uuid(), id), token)
        response.send(content)
    }
}
