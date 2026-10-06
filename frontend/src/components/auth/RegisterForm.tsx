'use client'

import Link from 'next/link'
import { postAuthPath, authPagePath } from '@/lib/auth-redirect'
import { isNative } from '@/lib/native/platform'
import { useRouter } from 'next/navigation'
import type { SubmitEvent } from 'react'
import { useState } from 'react'
import { LuLoaderCircle as LoaderCircleIcon } from 'react-icons/lu'

import SocialAuthButtons from '@/components/auth/SocialAuthButtons'
import Turnstile, { turnstileEnabled } from '@/components/Turnstile'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { authClient } from '@/lib/auth-client'
import { useSession } from '@/lib/use-session'
import { apiErrorMessage } from '@/lib/api/errors'

export default function RegisterForm() {
    const router = useRouter()
    const { refetch } = useSession()
    const [email, setEmail] = useState('')
    const [username, setUsername] = useState('')
    const [password, setPassword] = useState('')
    const [confirmPassword, setConfirmPassword] = useState('')
    const [message, setMessage] = useState<string | null>(null)
    const [pending, setPending] = useState(false)
    const [captchaResponse, setCaptchaResponse] = useState<string | null>(null)
    const [captchaResetSignal, setCaptchaResetSignal] = useState(0)

    const handleSubmit = async (event: SubmitEvent<HTMLFormElement>) => {
        event.preventDefault()

        const nextEmail = email.trim().toLowerCase()
        const nextUsername = username.trim()

        setMessage(null)

        if (nextUsername.length < 2) {
            setMessage('Name must be at least 2 characters.')
            return
        }

        if (password !== confirmPassword) {
            setMessage('Passwords do not match.')
            return
        }

        if (turnstileEnabled && !captchaResponse) {
            setMessage('Please complete the security check.')
            return
        }

        setPending(true)

        try {
            const response = await authClient.signUp.email({
                email: nextEmail,
                name: nextUsername,
                password,
                callbackURL: postAuthPath(),
                fetchOptions: captchaResponse ? { headers: { 'x-captcha-response': captchaResponse } } : undefined,
            })

            if (response?.error) {
                setMessage(response.error.message || 'Could not create account.')
                return
            }

            await refetch()
            router.replace(postAuthPath())
        } catch (error) {
            setMessage(apiErrorMessage(error, 'Could not create account. Please try again.'))
        } finally {
            setPending(false)
            if (turnstileEnabled) setCaptchaResetSignal((value) => value + 1)
        }
    }

    return (
        <Card className='w-sm border-foreground/15 bg-background'>
            <CardHeader>
                <CardTitle className='text-2xl'>Create your account</CardTitle>
                <CardDescription>Choose a display name and password for your new account.</CardDescription>
            </CardHeader>
            <CardContent className='flex flex-col gap-5'>
                <SocialAuthButtons disabled={pending} errorCallbackURL='/register' requestSignUp />

                {!(isNative && turnstileEnabled) && (
                    <form onSubmit={handleSubmit} className='flex flex-col gap-3'>
                        <label className='flex flex-col gap-1.5 text-sm font-medium'>
                            Name
                            <Input
                                autoComplete='name'
                                disabled={pending}
                                minLength={2}
                                onChange={(event) => setUsername(event.target.value)}
                                required
                                type='text'
                                value={username}
                            />
                        </label>

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

                        <label className='flex flex-col gap-1.5 text-sm font-medium'>
                            Password
                            <Input
                                autoComplete='new-password'
                                disabled={pending}
                                minLength={8}
                                onChange={(event) => setPassword(event.target.value)}
                                required
                                type='password'
                                value={password}
                            />
                        </label>

                        <label className='flex flex-col gap-1.5 text-sm font-medium'>
                            Confirm password
                            <Input
                                autoComplete='new-password'
                                disabled={pending}
                                minLength={8}
                                onChange={(event) => setConfirmPassword(event.target.value)}
                                required
                                type='password'
                                value={confirmPassword}
                            />
                        </label>

                        {message && (
                            <p className='rounded-md border border-border bg-muted/50 px-3 py-2 text-sm'>{message}</p>
                        )}

                        <Turnstile onTokenChange={setCaptchaResponse} resetSignal={captchaResetSignal} />

                        <Button type='submit' disabled={pending}>
                            {pending && <LoaderCircleIcon data-icon='inline-start' className='animate-spin' />}
                            Create account
                        </Button>
                    </form>
                )}

                <Button variant='link' asChild>
                    <Link
                        href='/login'
                        onClick={(event) => {
                            event.preventDefault()
                            router.push(authPagePath('login'))
                        }}
                    >
                        Already have an account? Log in
                    </Link>
                </Button>
            </CardContent>
        </Card>
    )
}
