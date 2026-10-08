'use client'

import Script from 'next/script'
import { useCallback, useEffect, useRef } from 'react'

type TurnstileWidgetOptions = {
    sitekey: string
    callback: (token: string) => void
    'error-callback': () => void
    'expired-callback': () => void
    theme: 'auto' | 'dark' | 'light'
}

type TurnstileApi = {
    remove(widgetId: string): void
    render(container: HTMLElement, options: TurnstileWidgetOptions): string
    reset(widgetId: string): void
}

declare global {
    interface Window {
        turnstile?: TurnstileApi
    }
}

type TurnstileProps = {
    siteKey?: string | null
    onTokenChange: (token: string | null) => void
    resetSignal?: number
    theme?: 'auto' | 'light' | 'dark'
}

export const turnstileEnabled = Boolean(process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY?.trim())

export default function Turnstile({
    onTokenChange,
    resetSignal = 0,
    theme = 'auto',
    siteKey: providedSiteKey,
}: TurnstileProps) {
    const containerRef = useRef<HTMLDivElement>(null)
    const widgetIdRef = useRef<string | null>(null)
    const siteKey = (providedSiteKey ?? process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY)?.trim()

    const renderWidget = useCallback(() => {
        if (!siteKey || !window.turnstile || !containerRef.current || widgetIdRef.current) {
            return
        }

        widgetIdRef.current = window.turnstile.render(containerRef.current, {
            sitekey: siteKey,
            theme,
            callback: (token) => onTokenChange(token),
            'error-callback': () => onTokenChange(null),
            'expired-callback': () => onTokenChange(null),
        })
    }, [onTokenChange, siteKey, theme])

    useEffect(() => {
        renderWidget()

        return () => {
            if (window.turnstile && widgetIdRef.current) {
                window.turnstile.remove(widgetIdRef.current)
                widgetIdRef.current = null
            }
        }
    }, [renderWidget])

    useEffect(() => {
        if (resetSignal > 0 && window.turnstile && widgetIdRef.current) {
            window.turnstile.reset(widgetIdRef.current)
            onTokenChange(null)
        }
    }, [onTokenChange, resetSignal])

    if (!siteKey) return null

    return (
        <>
            <Script
                id='cloudflare-turnstile'
                src='https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit'
                strategy='afterInteractive'
                onReady={renderWidget}
            />
            <div ref={containerRef} className='flex min-h-[65px] justify-center' />
        </>
    )
}
