import { z } from 'zod'

export const SocialProviderSchema = z.enum(['google', 'microsoft', 'github', 'facebook'])

export const PublicConfigSchema = z.object({
    native: z.object({ enabled: z.boolean(), scheme: z.string().nullable() }).optional(),
    captcha: z.object({ enabled: z.boolean(), expoReturnUrls: z.array(z.string()) }).optional(),
    socialProviders: z.array(SocialProviderSchema),
    features: z.object({
        search: z.boolean(),
        uploads: z.boolean(),
        passwordReset: z.boolean(),
        payments: z.boolean(),
    }),
})

export type SocialProvider = z.infer<typeof SocialProviderSchema>
export type PublicConfig = z.infer<typeof PublicConfigSchema>
