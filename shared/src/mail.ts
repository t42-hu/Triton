import z from 'zod'

const EmailSchema = z.email()
const EmailListSchema = z.union([EmailSchema, z.array(EmailSchema).min(1)])

export const MailSchema = z
    .object({
        from: EmailSchema.optional(),
        to: EmailListSchema,

        cc: EmailListSchema.optional(),
        bcc: EmailListSchema.optional(),

        replyTo: EmailSchema.optional(),

        subject: z.string().trim().min(1),
        text: z.string().trim().min(1).optional(),
        html: z.string().trim().min(1).optional(),
    })
    .superRefine((mail, ctx) => {
        if (!mail.text && !mail.html) {
            ctx.addIssue({
                code: 'custom',
                message: 'Email must have text or html body.',
                path: ['text'],
            })
        }
    })

export type Mail = z.infer<typeof MailSchema>
