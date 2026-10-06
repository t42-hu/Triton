'use client'
import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { authClient } from '@/lib/auth-client'
import { useSession } from '@/lib/use-session'
import { handleNativeDeepLink } from '@/lib/native/auth'
import { apiErrorMessage } from '@/lib/api/errors'
import { isNative, nativePlatform } from '@/lib/native/platform'

export default function NativeLifecycle() {
    const router = useRouter()
    const { refetch } = useSession()
    useEffect(() => {
        const platform = nativePlatform()
        if (!isNative || !platform) return
        const sessionChanged = () => authClient.$store.notify('$sessionSignal')
        window.addEventListener('fullstack-session-change', sessionChanged)
        const browserError = () => toast.error('Could not open this link in your browser.')
        const storageError = () =>
            toast.error('Could not access secure storage. Unlock your system keychain and try again.')
        window.addEventListener('fullstack-browser-error', browserError)
        window.addEventListener('fullstack-storage-error', storageError)
        let disposed = false
        let remove: (() => void) | undefined
        let queue = Promise.resolve()
        const handle = (url: string) => {
            queue = queue.then(async () => {
                if (disposed) return
                try {
                    const path = await handleNativeDeepLink(url)
                    await refetch()
                    router.replace(path)
                } catch (error) {
                    toast.error(apiErrorMessage(error, 'Could not open application link'))
                }
            })
        }
        void (async () => {
            const unsubscribe = await platform.onDeepLink(handle)
            if (disposed) {
                unsubscribe()
                return
            }
            remove = unsubscribe
            const launch = await platform.getLaunchUrl()
            if (launch) handle(launch)
        })().catch(() => toast.error('Could not initialize application links'))
        return () => {
            disposed = true
            remove?.()
            window.removeEventListener('fullstack-session-change', sessionChanged)
            window.removeEventListener('fullstack-browser-error', browserError)
            window.removeEventListener('fullstack-storage-error', storageError)
        }
    }, [router, refetch])
    return null
}
