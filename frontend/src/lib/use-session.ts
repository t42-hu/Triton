'use client'

import { useSyncExternalStore } from 'react'
import { authClient } from './auth-client'

const subscribe = () => () => {}
const clientSnapshot = () => true
const serverSnapshot = () => false

export function useSession() {
    const session = authClient.useSession()
    // Static HTML has no account. A fast shared session fetch may finish before
    // every component hydrates, so keep its first render identical to that HTML.
    const hydrated = useSyncExternalStore(subscribe, clientSnapshot, serverSnapshot)
    return {
        ...session,
        data: hydrated ? session.data : null,
        isPending: !hydrated || session.isPending,
    }
}
