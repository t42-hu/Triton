import { z } from 'zod'

export const CheckoutSessionSchema = z.object({
    requestId: z.uuid(),
    priceId: z.string().trim().min(1).max(255),
})

export type CheckoutSession = z.infer<typeof CheckoutSessionSchema>
