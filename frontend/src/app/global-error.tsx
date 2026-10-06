'use client'

import '../../globals.css'
import { useEffect } from 'react'

export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
    useEffect(() => {
        console.error(error)
    }, [error])

    return (
        <html lang='en' className='dark font-sans'>
            <body className='min-h-dvh bg-background text-foreground'>
                <main className='mx-auto flex min-h-dvh max-w-xl flex-col items-center justify-center gap-5 px-6 text-center'>
                    <h1 className='text-3xl font-semibold'>Application unavailable</h1>
                    <p className='text-muted-foreground'>An unexpected application error occurred.</p>
                    <button
                        className='rounded-md bg-primary px-4 py-2 text-primary-foreground'
                        onClick={reset}
                        type='button'
                    >
                        Try again
                    </button>
                </main>
            </body>
        </html>
    )
}
