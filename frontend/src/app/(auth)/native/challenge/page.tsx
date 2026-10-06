import { Suspense } from 'react'
import ExpoChallenge from '@/components/auth/ExpoChallenge'
export default function ExpoChallengePage() {
    return (
        <Suspense fallback={null}>
            <ExpoChallenge />
        </Suspense>
    )
}
