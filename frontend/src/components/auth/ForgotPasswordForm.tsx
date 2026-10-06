'use client'

import Link from 'next/link'
import { isNative, requireNativePlatform } from '@/lib/native/platform'
import { prepareNativePasswordReset } from '@/lib/native/auth'
import { usePublicConfig } from '@/lib/public-config'
import type { SubmitEvent } from 'react'
import { useState } from 'react'
import { LuLoaderCircle as LoaderCircleIcon } from 'react-icons/lu'

import { Button } from '@/components/ui/button'
import Turnstile, { turnstileEnabled } from '@/components/Turnstile'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { requestPasswordReset } from '@/lib/api/auth'
import { apiErrorMessage } from '@/lib/api/errors'

export default function ForgotPasswordForm() {
    const publicConfig = usePublicConfig()
    const [email, setEmail] = useState('')
    const [message, setMessage] = useState<string | null>(null)
    const [pending, setPending] = useState(false)
    const [captchaResponse, setCaptchaResponse] = useState<string | null>(null)
    const [captchaResetSignal, setCaptchaResetSignal] = useState(0)

    const handleSubmit = async (event: SubmitEvent) => {
        event.preventDefault()

        const normalizedEmail = email.trim().toLowerCase()

        setMessage(null)

        if (turnstileEnabled && !captchaResponse) {
            setMessage('Please complete the security check.')
            return
        }

        setPending(true)

        try {
            const flow = new URLSearchParams(window.location.search).get('flow')
            const nativeReset = isNative ? await prepareNativePasswordReset() : null
            await requestPasswordReset(
                {
                    email: normalizedEmail,
                    redirectTo:
                        nativeReset?.redirectTo ||
                        (flow && /^[a-f0-9]{64}$/.test(flow)
                            ? `${process.env.NEXT_PUBLIC_APP_URL}/native/reset?${new URLSearchParams({ flow })}`
                            : '/reset-password'),
                },
                captchaResponse,
            )

            setMessage('If an account exists, reset instructions are on the way.')
        } catch (error) {
            setMessage(apiErrorMessage(error, 'Could not send reset instructions. Please try again.'))
        } finally {
            setPending(false)
            if (turnstileEnabled) setCaptchaResetSignal((value) => value + 1)
        }
    }

    if (isNative && turnstileEnabled)
        return (
            <Card className='w-full max-w-sm'>
                <CardContent className='flex flex-col gap-4'>
                    <p>Continue in your browser to reset your password.</p>
                    <Button
                        onClick={async () => {
                            try {
                                const { browserUrl } = await prepareNativePasswordReset()
                                await requireNativePlatform().openExternal(browserUrl)
                            } catch (error) {
                                setMessage(apiErrorMessage(error, 'Could not open your browser. Please try again.'))
                            }
                        }}
                    >
                        Reset in browser
                    </Button>
                    {message && <p role='alert'>{message}</p>}
                </CardContent>
            </Card>
        )

    return (
        <Card className='w-sm border-foreground/15 bg-background'>
            <CardHeader>
                <CardTitle className='text-2xl'>Reset your password</CardTitle>
                <CardDescription>Enter your email and we will send you a reset link.</CardDescription>
            </CardHeader>
            <CardContent className='flex flex-col gap-5'>
                <form onSubmit={handleSubmit} className='flex flex-col gap-3'>
                    <label className='flex flex-col gap-1.5 text-sm font-medium'>
                        Email
                        <Input
                            autoComplete='email'
                            disabled={pending}
                            onChange={(event) => setEmail(event.target.value)}
                            required
                            type='email'
                            value={email}
                        />
                    </label>

                    {message && (
                        <p className='rounded-md border border-border bg-muted/50 px-3 py-2 text-sm'>{message}</p>
                    )}

                    {publicConfig && !publicConfig.features.passwordReset && (
                        <p>Password reset is unavailable. Contact support.</p>
                    )}
                    <Turnstile onTokenChange={setCaptchaResponse} resetSignal={captchaResetSignal} />

                    <Button type='submit' disabled={pending || !publicConfig?.features.passwordReset}>
                        {pending && <LoaderCircleIcon data-icon='inline-start' className='animate-spin' />}
                        Send reset link
                    </Button>
                </form>

                <Button variant='link' asChild>
                    <Link href='/login'>Back to log in</Link>
                </Button>
            </CardContent>
        </Card>
    )
}
