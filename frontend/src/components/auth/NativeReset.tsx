'use client'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { usePublicConfig } from '@/lib/public-config'
import { Button } from '@/components/ui/button'
import { useState } from 'react'
import { parseApiResponse } from '@/lib/api/api-helper'
import { resetNativeAuth } from '@/lib/api/generated/client'
import { apiErrorMessage } from '@/lib/api/errors'
import { NativeCallbackResponseSchema } from '@fullstack-starter/shared'

export default function NativeReset() {
    const token = useSearchParams().get('token')
    const flow = useSearchParams().get('flow')
    const config = usePublicConfig()
    const [callback, setCallback] = useState<string>()
    const [pending, setPending] = useState(false)
    const [error, setError] = useState('')
    async function prepare() {
        setPending(true)
        setError('')
        try {
            if (!flow || !token) throw new Error('Missing app reset request')
            const { callbackUrl } = parseApiResponse(
                await resetNativeAuth({ flow, token }),
                NativeCallbackResponseSchema,
            )
            if (new URL(callbackUrl).protocol !== `${config?.native?.scheme}:`)
                throw new Error('Invalid app reset link')
            setCallback(callbackUrl)
        } catch (e) {
            setError(apiErrorMessage(e, 'Could not prepare app link'))
        } finally {
            setPending(false)
        }
    }
    if (!token || !/^[A-Za-z0-9_-]{16,256}$/.test(token)) return <p>This reset link is invalid or expired.</p>
    return (
        <section className='flex max-w-md flex-col gap-4 rounded-xl border p-6'>
            <h1 className='text-2xl font-semibold'>Reset your password</h1>
            <p>Open the app to choose a new password, or continue in this browser.</p>
            {config?.native?.enabled &&
                flow &&
                /^[a-f0-9]{64}$/.test(flow) &&
                (callback ? (
                    <Button asChild>
                        <a href={callback}>Open app</a>
                    </Button>
                ) : (
                    <Button disabled={pending} onClick={prepare}>
                        Continue in app
                    </Button>
                ))}
            {error && <p role='alert'>{error}</p>}
            <Button variant='outline' asChild>
                <Link href={`/reset-password?${new URLSearchParams({ token })}`}>Continue in browser</Link>
            </Button>
        </section>
    )
}
