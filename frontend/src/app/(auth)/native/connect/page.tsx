import { Suspense } from 'react'
import NativeConnect from '@/components/auth/NativeConnect'
export default function NativeConnectPage() {
    return (
        <Suspense fallback={null}>
            <NativeConnect />
        </Suspense>
    )
}
