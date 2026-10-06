import { BadRequestException, Body, Controller, Headers, Post, Req } from '@nestjs/common'
import type { RawBodyRequest } from '@nestjs/common'
import { AllowAnonymous, Session, type UserSession } from '@thallesp/nestjs-better-auth'
import type { Request } from 'express'
import { CheckoutSessionSchema, type CheckoutSession } from '@fullstack-starter/shared'
import { PaymentService } from './payment.service.js'

@Controller('payments')
export class PaymentController {
    constructor(private readonly paymentService: PaymentService) {}

    @Post('checkout/sessions')
    async createCheckoutSession(@Session() session: UserSession, @Body() body: CheckoutSession) {
        const parsed = CheckoutSessionSchema.safeParse(body)
        if (!parsed.success) {
            throw new BadRequestException('Invalid checkout session')
        }

        const checkoutSession = await this.paymentService.createCheckoutSession(
            parsed.data,
            session.user.id,
            session.user.email,
        )

        return {
            id: checkoutSession.id,
            url: checkoutSession.url,
        }
    }

    @Post('webhooks/stripe')
    @AllowAnonymous()
    async handleStripeWebhook(
        @Req() request: RawBodyRequest<Request>,
        @Headers('stripe-signature') signature?: string,
    ) {
        if (!request.rawBody || !signature) {
            throw new BadRequestException('Missing Stripe webhook payload or signature')
        }

        const event = this.paymentService.constructWebhookEvent(request.rawBody, signature)
        await this.paymentService.handleWebhookEvent(event)

        return { received: true }
    }
}
