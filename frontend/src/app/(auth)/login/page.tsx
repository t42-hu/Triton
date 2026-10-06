import LoginForm from '@/components/auth/LoginForm'
import { loginPageMetadata } from '@/lib/metadata'

export const metadata = loginPageMetadata

export default function LoginPage() {
    return <LoginForm />
}
