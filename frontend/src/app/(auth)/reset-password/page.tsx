import ResetPasswordForm from '@/components/auth/ResetPasswordForm'
import { resetPasswordPageMetadata } from '@/lib/metadata'
import { Suspense } from 'react'

export const metadata = resetPasswordPageMetadata

export default function ResetPasswordPage() {
    return (
        <Suspense fallback={null}>
            <ResetPasswordForm />
        </Suspense>
    )
}
