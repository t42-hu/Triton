import Link from 'next/link'
import { buttonVariants } from '@/components/ui/button'

export default function NotFoundPage() {
    return (
        <main className='mx-auto flex min-h-dvh max-w-xl flex-col items-center justify-center gap-5 px-6 text-center'>
            <p className='text-sm font-medium text-muted-foreground'>404</p>
            <h1 className='text-3xl font-semibold'>Page not found</h1>
            <p className='text-muted-foreground'>The requested page does not exist or has been moved.</p>
            <Link href='/' className={buttonVariants()}>
                Return home
            </Link>
        </main>
    )
}
