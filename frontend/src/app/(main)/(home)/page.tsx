import Link from 'next/link'
import { buttonVariants } from '@/components/ui/button'
import { homePageMetadata } from '@/lib/metadata'
import { siteName, siteDescription } from '@/lib/constants'

export const metadata = homePageMetadata

export default function HomePage() {
    return (
        <main className='mx-auto flex min-h-dvh w-full max-w-4xl flex-col justify-center gap-6 px-6 pb-16 pt-32'>
            <h1 className='text-4xl font-semibold tracking-tight'>{siteName}</h1>
            <p className='text-muted-foreground'>{siteDescription}</p>
            <div className='flex flex-wrap gap-3'>
                <Link href='/register' className={buttonVariants()}>
                    Create an account
                </Link>
                <Link href='/profile' className={buttonVariants({ variant: 'outline' })}>
                    View profile
                </Link>
            </div>
        </main>
    )
}
