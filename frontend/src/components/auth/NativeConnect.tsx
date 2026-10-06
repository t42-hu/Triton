'use client'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { useState } from 'react'
import { parseApiResponse } from '@/lib/api/api-helper'
import { authorizeNativeAuth } from '@/lib/api/generated/client'
import { apiErrorMessage } from '@/lib/api/errors'
import { useSession } from '@/lib/use-session'
import { usePublicConfig } from '@/lib/public-config'
import { Button } from '@/components/ui/button'
import { NativeCallbackResponseSchema } from '@fullstack-starter/shared'

export default function NativeConnect() {
    const flow = useSearchParams().get('flow')
    const { data, isPending } = useSession()
    const config = usePublicConfig()
    const [callback, setCallback] = useState<string>()
    const [error, setError] = useState('')
    const [pending, setPending] = useState(false)
    if (!flow || !/^[a-f0-9]{64}$/.test(flow)) return <p>Invalid app sign-in link.</p>
    const returnTo = `/native/connect?flow=${flow}`
    async function authorize() {
        setPending(true)
        setError('')
        try {
            if (!flow) throw new Error('Missing app sign-in request')
            const { callbackUrl } = parseApiResponse(await authorizeNativeAuth({ flow }), NativeCallbackResponseSchema)
            if (new URL(callbackUrl).protocol !== `${config?.native?.scheme}:`)
                throw new Error('Invalid application callback')
            setCallback(callbackUrl)
        } catch (e) {
            setError(apiErrorMessage(e, 'Could not authorize app'))
        } finally {
            setPending(false)
        }
    }
    return (
        <section className='flex w-full max-w-md flex-col gap-4 rounded-xl border p-6'>
            <h1 className='text-2xl font-semibold'>Sign in to the app</h1>
            <p>Continue only if you started this request in your mobile app.</p>
            {isPending ? (
                <p>Checking your account…</p>
            ) : !data ? (
                <>
                    <Button asChild>
                        <Link href={`/login?${new URLSearchParams({ redirectTo: returnTo })}`}>Log in to continue</Link>
                    </Button>
                    <Button variant='outline' asChild>
                        <Link href={`/register?${new URLSearchParams({ redirectTo: returnTo })}`}>
                            Create an account
                        </Link>
                    </Button>
                </>
            ) : (
                <>
                    <p>Continue as {data.user.email}</p>
                    {callback ? (
                        <Button asChild>
                            <a href={callback}>Open app</a>
                        </Button>
                    ) : (
                        <Button disabled={pending || !config?.native?.enabled} onClick={authorize}>
                            Authorize app
                        </Button>
                    )}
                </>
            )}
            {error && <p role='alert'>{error}</p>}
        </section>
    )
}
