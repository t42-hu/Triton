import { Suspense } from 'react'
import NativeReset from '@/components/auth/NativeReset'
export default function NativeResetPage() {
    return (
        <Suspense fallback={null}>
            <NativeReset />
        </Suspense>
    )
}
