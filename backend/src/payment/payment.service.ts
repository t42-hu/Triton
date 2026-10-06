import { BadRequestException, Injectable, ServiceUnavailableException } from '@nestjs/common'
import { applicationOrigin, type CheckoutSession } from '@fullstack-starter/shared'
import { eq, sql } from 'drizzle-orm'
import Stripe from 'stripe'
import { DatabaseService } from '../database/database.service.js'
import { billingCustomer, paymentEvent, payment } from '../database/database.schema.js'
import { PaymentEventHandler } from './payment-event.handler.js'

@Injectable()
export class PaymentService {
    private client?: Stripe
    constructor(
        private readonly database: DatabaseService,
        private readonly handler: PaymentEventHandler,
    ) {}

    async createCheckoutSession(input: CheckoutSession, userId: string, customerEmail: string) {
        const allowed = new Set(
            (process.env.STRIPE_ALLOWED_PRICE_IDS || '')
                .split(',')
                .map((value) => value.trim())
                .filter(Boolean),
        )
        if (!allowed.has(input.priceId)) throw new BadRequestException('Invalid checkout price')
        const stripe = this.getClient()
        // Serialize customer creation across processes; Stripe's key also protects retries.
        const customerId = await this.database.db.transaction(async (tx) => {
            await tx.execute(sql`select pg_advisory_xact_lock(hashtextextended(${`customer:${userId}`}, 0))`)
            const [existing] = await tx.select().from(billingCustomer).where(eq(billingCustomer.userId, userId))
            if (existing) return existing.stripeCustomerId
            const customer = await stripe.customers.create(
                { email: customerEmail, metadata: { userId } },
                { idempotencyKey: `customer:${userId}` },
            )
            await tx.insert(billingCustomer).values({ userId, stripeCustomerId: customer.id })
            return customer.id
        })
        const origin = applicationOrigin(process.env)
        return stripe.checkout.sessions.create(
            {
                cancel_url: `${origin}/profile?checkout=cancelled`,
                success_url: `${origin}/profile?checkout=success`,
                customer: customerId,
                client_reference_id: userId,
                metadata: { userId },
                line_items: [{ price: input.priceId, quantity: 1 }],
                mode: 'payment',
            },
            { idempotencyKey: `checkout:${userId}:${input.requestId}` },
        )
    }

    constructWebhookEvent(payload: Buffer | string, signature: string): Stripe.Event {
        const secret = process.env.STRIPE_WEBHOOK_SECRET
        if (!secret) throw new ServiceUnavailableException('Stripe webhooks are not configured')
        try {
            return this.getClient().webhooks.constructEvent(payload, signature, secret)
        } catch {
            throw new BadRequestException('Invalid Stripe signature')
        }
    }

    async handleWebhookEvent(event: Stripe.Event) {
        return this.database.db.transaction(async (tx) => {
            await tx.execute(sql`select pg_advisory_xact_lock(hashtextextended(${`stripe:${event.id}`}, 0))`)
            const [existing] = await tx.select().from(paymentEvent).where(eq(paymentEvent.id, event.id))
            if (existing?.processedAt) return { duplicate: true }
            await tx
                .insert(paymentEvent)
                .values({ id: event.id, type: event.type, payload: event })
                .onConflictDoNothing()
            if (
                [
                    'checkout.session.completed',
                    'checkout.session.async_payment_succeeded',
                    'checkout.session.async_payment_failed',
                ].includes(event.type)
            ) {
                const session = event.data.object as Stripe.Checkout.Session
                const userId = session.metadata?.userId || session.client_reference_id
                if (userId) {
                    const customerId = typeof session.customer === 'string' ? session.customer : session.customer?.id
                    const [linked] = await tx.select().from(billingCustomer).where(eq(billingCustomer.userId, userId))
                    if (!linked || linked.stripeCustomerId !== customerId)
                        throw new BadRequestException('Checkout customer does not match user')
                    await tx.execute(
                        sql`select pg_advisory_xact_lock(hashtextextended(${`checkout:${session.id}`}, 0))`,
                    )
                    // Paid is terminal: out-of-order completion/failure events cannot undo it.
                    const [current] = await tx
                        .select()
                        .from(payment)
                        .where(eq(payment.checkoutSessionId, session.id))
                        .for('update')
                    const status =
                        current?.status === 'paid' || session.payment_status === 'paid'
                            ? 'paid'
                            : event.type.endsWith('failed')
                              ? 'failed'
                              : 'pending'
                    await tx
                        .insert(payment)
                        .values({
                            checkoutSessionId: session.id,
                            userId,
                            stripeCustomerId: customerId,
                            status,
                            currency: session.currency,
                            amountTotal: session.amount_total?.toString(),
                        })
                        .onConflictDoUpdate({
                            target: payment.checkoutSessionId,
                            set: { status, updatedAt: new Date() },
                        })
                }
            }
            await this.handler.handle(event, tx)
            await tx.update(paymentEvent).set({ processedAt: new Date() }).where(eq(paymentEvent.id, event.id))
            return { duplicate: false }
        })
    }

    private getClient(): Stripe {
        if (!process.env.STRIPE_SECRET_KEY) throw new ServiceUnavailableException('Stripe is not configured')
        this.client ??= new Stripe(process.env.STRIPE_SECRET_KEY, {
            timeout: 10000,
            maxNetworkRetries: 2,
        })
        return this.client
    }
}
