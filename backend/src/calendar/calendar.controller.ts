import {
    Body,
    Injectable,
    type NestInterceptor,
    type ExecutionContext,
    type CallHandler,
    Controller,
    Delete,
    Get,
    Param,
    Patch,
    Post,
    Query,
    Res,
    StreamableFile,
    UploadedFile,
    UseInterceptors,
} from '@nestjs/common'
import { FileInterceptor } from '@nestjs/platform-express'
import { Session, type UserSession } from '@thallesp/nestjs-better-auth'
import type { Response } from 'express'
import { Readable } from 'node:stream'
import { CalendarIdSchema } from '@fullstack-starter/shared'
import { CalendarService, parse } from './calendar.service.js'
import { CalendarActions } from './calendar.actions.js'
import { CalendarSync } from './calendar.sync.js'
import { CalendarFiles } from './calendar.files.js'

@Injectable()
export class CalendarPrivacyInterceptor implements NestInterceptor {
    intercept(context: ExecutionContext, next: CallHandler) {
        const response = context.switchToHttp().getResponse<Response>()
        response.setHeader('Cache-Control', 'private, no-store')
        response.vary('Cookie')
        response.vary('Authorization')
        return next.handle()
    }
}
@UseInterceptors(CalendarPrivacyInterceptor)
@Controller('calendar')
export class CalendarController {
    constructor(readonly calendar: CalendarService) {}
    @Get(':resource') list(
        @Session() session: UserSession,
        @Param('resource') resource: string,
        @Query() query: unknown,
    ) {
        return this.calendar.transaction(
            (db) => this.calendar.list(db, session.user.id, this.calendar.resource(resource), query),
            false,
        )
    }
    @Get(':resource/:id') get(
        @Session() session: UserSession,
        @Param('resource') resource: string,
        @Param('id') id: string,
    ) {
        return this.calendar.transaction(
            (db) =>
                this.calendar.get(db, session.user.id, this.calendar.resource(resource), parse(CalendarIdSchema, id)),
            false,
        )
    }
    @Post(':resource') create(
        @Session() session: UserSession,
        @Param('resource') resource: string,
        @Body() body: unknown,
    ) {
        return this.calendar.transaction((db) =>
            this.calendar.create(db, session.user.id, this.calendar.resource(resource), body),
        )
    }
    @Patch(':resource/:id') update(
        @Session() session: UserSession,
        @Param('resource') resource: string,
        @Param('id') id: string,
        @Body() body: unknown,
    ) {
        return this.calendar.transaction((db) =>
            this.calendar.update(
                db,
                session.user.id,
                this.calendar.resource(resource),
                parse(CalendarIdSchema, id),
                body,
            ),
        )
    }
    @Delete(':resource/:id') remove(
        @Session() session: UserSession,
        @Param('resource') resource: string,
        @Param('id') id: string,
        @Body() body: unknown,
    ) {
        return this.calendar.transaction((db) =>
            this.calendar.remove(
                db,
                session.user.id,
                this.calendar.resource(resource),
                parse(CalendarIdSchema, id),
                body,
            ),
        )
    }
}
@UseInterceptors(CalendarPrivacyInterceptor)
@Controller('calendar-actions')
export class CalendarActionsController {
    constructor(
        readonly actions: CalendarActions,
        readonly files: CalendarFiles,
    ) {}
    @Post('invitations') invite(@Session() s: UserSession, @Body() body: unknown) {
        return this.actions.invite(s.user.id, body)
    }
    @Post('invitations/:id/respond') respondInvitation(
        @Session() s: UserSession,
        @Param('id') id: string,
        @Body() body: unknown,
    ) {
        return this.actions.respondInvitation(s.user.id, parse(CalendarIdSchema, id), body)
    }
    @Post('meetings') meeting(@Session() s: UserSession, @Body() body: unknown) {
        return this.actions.createMeeting(s.user.id, body)
    }
    @Post('meetings/:id/invite') inviteMeeting(
        @Session() s: UserSession,
        @Param('id') id: string,
        @Body() body: unknown,
    ) {
        return this.actions.inviteMeeting(s.user.id, parse(CalendarIdSchema, id), body)
    }
    @Post('meetings/:id/respond') respondMeeting(
        @Session() s: UserSession,
        @Param('id') id: string,
        @Body() body: unknown,
    ) {
        return this.actions.respondMeeting(s.user.id, parse(CalendarIdSchema, id), body)
    }
    @Post('sources/:id/publish') publish(@Session() s: UserSession, @Param('id') id: string, @Body() body: unknown) {
        return this.files.publish(s.user.id, parse(CalendarIdSchema, id), body)
    }
}
@UseInterceptors(CalendarPrivacyInterceptor)
@Controller('sync')
export class CalendarSyncController {
    constructor(readonly sync: CalendarSync) {}
    @Post('devices') register(@Session() s: UserSession, @Body() body: unknown) {
        return this.sync.register(s.user.id, body)
    }
    @Get('snapshot') snapshot(@Session() s: UserSession, @Query() query: unknown) {
        return this.sync.snapshot(s.user.id, query)
    }
    @Get('pull') pull(@Session() s: UserSession, @Query() query: unknown) {
        return this.sync.pull(s.user.id, query)
    }
    @Post('push') push(@Session() s: UserSession, @Body() body: unknown) {
        return this.sync.push(s.user.id, body)
    }
    @Post('ack') ack(@Session() s: UserSession, @Body() body: unknown) {
        return this.sync.ack(s.user.id, body)
    }
}
@UseInterceptors(CalendarPrivacyInterceptor)
@Controller('calendar-files')
export class CalendarFilesController {
    constructor(readonly files: CalendarFiles) {}
    @Post('events/:id')
    @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 20 * 1024 * 1024, files: 1, fields: 0 } }))
    upload(@Session() s: UserSession, @Param('id') id: string, @UploadedFile() file?: Express.Multer.File) {
        return this.files.upload(s.user.id, parse(CalendarIdSchema, id), file)
    }
    @Get('sources/:id/content')
    sourceContent(@Session() s: UserSession, @Param('id') id: string) {
        return this.files.sourceContent(s.user.id, parse(CalendarIdSchema, id))
    }
    @Get('attachments/:id')
    async download(@Session() s: UserSession, @Param('id') id: string, @Res({ passthrough: true }) response: Response) {
        const file = await this.files.download(s.user.id, parse(CalendarIdSchema, id))
        response.setHeader('Cache-Control', 'private, no-store')
        response.setHeader('X-Content-Type-Options', 'nosniff')
        return new StreamableFile(file.body as Readable, {
            type: 'application/octet-stream',
            disposition: `attachment; filename*=UTF-8''${encodeURIComponent(file.name)}`,
            length: file.size,
        })
    }
}
