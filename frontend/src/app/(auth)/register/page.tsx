import RegisterForm from '@/components/auth/RegisterForm'
import { registerPageMetadata } from '@/lib/metadata'

export const metadata = registerPageMetadata

export default function RegisterPage() {
    return <RegisterForm />
}
