import { Injectable } from '@nestjs/common'
import type Stripe from 'stripe'
import type { DatabaseService } from '../database/database.service.js'

export type PaymentTransaction = Parameters<Parameters<DatabaseService['db']['transaction']>[0]>[0]

@Injectable()
export class PaymentEventHandler {
    // Add product database effects using this transaction. For external effects,
    // write a transactional outbox record here and deliver it with a worker.
    // Never call non-idempotent external services inside this transaction.
    async handle(_event: Stripe.Event, _transaction: PaymentTransaction): Promise<void> {
        void _event
        void _transaction
    }
}
