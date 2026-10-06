'use client'

import { useEffect } from 'react'
import { Button } from '@/components/ui/button'

export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
    useEffect(() => {
        console.error(error)
    }, [error])

    return (
        <main className='mx-auto flex min-h-dvh max-w-xl flex-col items-center justify-center gap-5 px-6 text-center'>
            <h1 className='text-3xl font-semibold'>Something went wrong</h1>
            <p className='text-muted-foreground'>The request could not be completed. You can safely try again.</p>
            <Button onClick={reset}>Try again</Button>
        </main>
    )
}
