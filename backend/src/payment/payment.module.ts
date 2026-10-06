import { DatabaseModule } from '../database/database.module.js'
import { PaymentEventHandler } from './payment-event.handler.js'
import { Module } from '@nestjs/common'
import { PaymentController } from './payment.controller.js'
import { PaymentService } from './payment.service.js'

@Module({
    imports: [DatabaseModule],
    controllers: [PaymentController],
    providers: [PaymentService, PaymentEventHandler],
    exports: [PaymentService],
})
export class PaymentModule {}
