'use client'

import { PublicConfigSchema, type SocialProvider } from '@fullstack-starter/shared'
import { useEffect, useState } from 'react'
import { FaFacebook, FaGithub, FaGoogle, FaMicrosoft } from 'react-icons/fa'
import { LuLoaderCircle as LoaderCircleIcon } from 'react-icons/lu'

import { Button } from '@/components/ui/button'
import { authClient } from '@/lib/auth-client'
import { postAuthPath } from '@/lib/auth-redirect'
import { isNative } from '@/lib/native/platform'
import { beginNativeSignIn } from '@/lib/native/auth'
import { apiErrorMessage } from '@/lib/api/errors'
import { parseApiResponse } from '@/lib/api/api-helper'
import { getPublicConfig } from '@/lib/api/generated/client'

const providerDetails = {
    google: { icon: FaGoogle, label: 'Google' },
    microsoft: { icon: FaMicrosoft, label: 'Microsoft' },
    github: { icon: FaGithub, label: 'GitHub' },
    facebook: { icon: FaFacebook, label: 'Facebook' },
} satisfies Record<SocialProvider, { icon: typeof FaGoogle; label: string }>

type SocialAuthButtonsProps = {
    disabled?: boolean
    errorCallbackURL: '/login' | '/register'
    requestSignUp: boolean
}

export default function SocialAuthButtons({ disabled, errorCallbackURL, requestSignUp }: SocialAuthButtonsProps) {
    const [nativeError, setNativeError] = useState('')
    const [nativePending, setNativePending] = useState(false)
    const [providers, setProviders] = useState<SocialProvider[]>([])
    const [pendingProvider, setPendingProvider] = useState<SocialProvider | null>(null)

    useEffect(() => {
        const controller = new AbortController()

        void getPublicConfig({ signal: controller.signal })
            .then((data) => setProviders(parseApiResponse(data, PublicConfigSchema).socialProviders))
            .catch(() => undefined)

        return () => controller.abort()
    }, [])

    const handleSocialAuth = async (provider: SocialProvider) => {
        setPendingProvider(provider)

        try {
            await authClient.signIn.social({
                provider,
                callbackURL: postAuthPath(),
                errorCallbackURL: `${errorCallbackURL}?${new URLSearchParams({ redirectTo: postAuthPath() })}`,
                requestSignUp,
            })
        } finally {
            setPendingProvider(null)
        }
    }

    if (isNative)
        return (
            <div className='flex flex-col gap-2'>
                <Button
                    type='button'
                    variant='outline'
                    disabled={disabled || nativePending}
                    onClick={async () => {
                        setNativePending(true)
                        setNativeError('')
                        try {
                            await beginNativeSignIn()
                        } catch (error) {
                            setNativeError(apiErrorMessage(error, 'Could not start sign-in'))
                        } finally {
                            setNativePending(false)
                        }
                    }}
                >
                    Continue in browser
                </Button>
                {nativeError && <p role='alert'>{nativeError}</p>}
            </div>
        )

    if (providers.length === 0) return null

    return (
        <div className='grid gap-5'>
            <div className='grid grid-cols-1 gap-2'>
                {providers.map((provider) => {
                    const { icon: Icon, label } = providerDetails[provider]
                    const isPending = pendingProvider === provider

                    return (
                        <Button
                            key={provider}
                            type='button'
                            variant='outline'
                            className='h-12'
                            disabled={disabled || Boolean(pendingProvider)}
                            onClick={() => handleSocialAuth(provider)}
                        >
                            {isPending ? (
                                <LoaderCircleIcon data-icon='inline-start' className='animate-spin' />
                            ) : (
                                <Icon data-icon='inline-start' />
                            )}
                            {label}
                        </Button>
                    )
                })}
            </div>
            <div className='flex items-center gap-3 text-xs text-muted-foreground'>
                <span className='h-px flex-1 bg-border' />
                <span>OR</span>
                <span className='h-px flex-1 bg-border' />
            </div>
        </div>
    )
}
