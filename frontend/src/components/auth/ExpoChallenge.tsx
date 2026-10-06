'use client'

import { useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { challengeReturnUrl } from '@fullstack-starter/shared'
import Turnstile, { turnstileEnabled } from '@/components/Turnstile'
import { usePublicConfig } from '@/lib/public-config'
import { Button } from '@/components/ui/button'

export default function ExpoChallenge() {
    const params = useSearchParams()
    const config = usePublicConfig()
    const [token, setToken] = useState<string | null>(null)
    if (!config) return <p>Loading security check…</p>
    let destination: URL
    const state = params.get('state') || ''
    try {
        destination = challengeReturnUrl(params.get('returnTo') || '', config.captcha?.expoReturnUrls || [], state)
    } catch {
        return <p role='alert'>This security check request is invalid. Return to the app and try again.</p>
    }
    if (!turnstileEnabled || !config.captcha?.enabled)
        return <p role='alert'>Security checks are unavailable. Return to the app and try again.</p>
    return (
        <section className='flex flex-col gap-6'>
            <h1 className='text-2xl font-semibold'>Verify to continue</h1>
            <Turnstile onTokenChange={setToken} />
            <Button
                disabled={!token}
                onClick={() => {
                    if (!token) return
                    destination.hash = new URLSearchParams({ captcha: token, state }).toString()
                    window.location.assign(destination.href)
                }}
            >
                Continue to app
            </Button>
        </section>
    )
}
