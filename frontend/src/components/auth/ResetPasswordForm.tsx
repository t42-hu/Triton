'use client'

import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import type { SubmitEvent } from 'react'
import { useState } from 'react'
import { LuLoaderCircle as LoaderCircleIcon } from 'react-icons/lu'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { resetPassword } from '@/lib/api/auth'
import { apiErrorMessage, ApiError } from '@/lib/api/errors'

export default function ResetPasswordForm() {
    const searchParams = useSearchParams()
    const token = searchParams.get('token')
    const resetError = searchParams.get('error')
    const [password, setPassword] = useState('')
    const [confirmPassword, setConfirmPassword] = useState('')
    const [message, setMessage] = useState<string | null>(null)
    const [complete, setComplete] = useState(false)
    const [pending, setPending] = useState(false)

    const invalidResetLink = !token || resetError

    const handleSubmit = async (event: SubmitEvent) => {
        event.preventDefault()

        setMessage(null)

        if (!token) {
            setMessage('This reset link is missing a token.')
            return
        }

        if (password !== confirmPassword) {
            setMessage('Passwords do not match.')
            return
        }

        setPending(true)

        try {
            await resetPassword({
                token,
                newPassword: password,
            })

            setComplete(true)
            setMessage('Your password has been updated.')
        } catch (error) {
            setMessage(
                error instanceof ApiError && ['offline', 'timeout', 'network', 'invalid-response'].includes(error.kind)
                    ? apiErrorMessage(error, 'Something went wrong. Please try again.')
                    : 'Could not reset your password. Please request a new link.',
            )
        } finally {
            setPending(false)
        }
    }

    return (
        <Card className='w-sm border-foreground/15 bg-background'>
            <CardHeader>
                <CardTitle className='text-2xl'>Choose a new password</CardTitle>
                <CardDescription>Use a password you have not used for this account before.</CardDescription>
            </CardHeader>
            <CardContent className='flex flex-col gap-5'>
                {invalidResetLink ? (
                    <p className='rounded-md border border-border bg-muted/50 px-3 py-2 text-sm'>
                        This reset link is invalid or expired. Request a new password reset email.
                    </p>
                ) : (
                    <form onSubmit={handleSubmit} className='flex flex-col gap-3'>
                        <label className='flex flex-col gap-1.5 text-sm font-medium'>
                            New password
                            <Input
                                autoComplete='new-password'
                                disabled={pending || complete}
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
                                disabled={pending || complete}
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

                        <Button type='submit' disabled={pending || complete}>
                            {pending && <LoaderCircleIcon data-icon='inline-start' className='animate-spin' />}
                            Update password
                        </Button>
                    </form>
                )}

                <Button variant='link' asChild>
                    <Link href={complete ? '/login' : '/forgot-password'}>
                        {complete ? 'Back to log in' : 'Request a new link'}
                    </Link>
                </Button>
            </CardContent>
        </Card>
    )
}
