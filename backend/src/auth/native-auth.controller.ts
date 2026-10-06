import { BadRequestException, Body, Controller, ForbiddenException, Header, Headers, Post } from '@nestjs/common'
import { AllowAnonymous, Session, type UserSession } from '@thallesp/nestjs-better-auth'
import { applicationOrigin, nativeOrigins } from '@fullstack-starter/shared'
import { NativeAuthService } from './native-auth.service.js'

@Controller('native-auth')
export class NativeAuthController {
    constructor(private readonly nativeAuth: NativeAuthService) {}
    private checkOrigin(origin: string | undefined, browser = false) {
        const allowed = browser ? [applicationOrigin(process.env)] : nativeOrigins(process.env)
        if (!origin || !allowed.includes(origin)) throw new ForbiddenException('Invalid native authentication origin')
    }
    @Post('start')
    @AllowAnonymous()
    @Header('Cache-Control', 'no-store')
    start(@Body() body: unknown, @Headers('origin') origin?: string) {
        this.checkOrigin(origin)
        return this.nativeAuth.start(body)
    }
    @Post('authorize')
    @Header('Cache-Control', 'no-store')
    authorize(@Body() body: { flow?: string }, @Session() session: UserSession, @Headers('origin') origin?: string) {
        this.checkOrigin(origin, true)
        if (typeof body?.flow !== 'string') throw new BadRequestException('Missing sign-in request')
        return this.nativeAuth.authorize(body.flow, session.user.id)
    }
    @Post('exchange')
    @AllowAnonymous()
    @Header('Cache-Control', 'no-store')
    exchange(@Body() body: unknown, @Headers('origin') origin?: string) {
        this.checkOrigin(origin)
        return this.nativeAuth.exchange(body)
    }
    @Post('reset-handoff')
    @AllowAnonymous()
    @Header('Cache-Control', 'no-store')
    resetHandoff(@Body() body: { flow?: string; token?: string }, @Headers('origin') origin?: string) {
        this.checkOrigin(origin, true)
        if (typeof body?.flow !== 'string' || typeof body?.token !== 'string')
            throw new BadRequestException('Invalid reset handoff')
        return this.nativeAuth.resetHandoff(body.flow, body.token)
    }
}
