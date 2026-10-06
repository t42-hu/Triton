import '../../globals.css'
import { rootMetadata } from '@/lib/metadata'
import { Toaster } from 'sonner'
import NativeLifecycle from '@/components/auth/NativeLifecycle'

export const metadata = rootMetadata

export default function RootLayout({ children }: { children: React.ReactNode }) {
    return (
        <html lang='en' className='dark font-sans' suppressHydrationWarning>
            <body className='min-h-dvh bg-background text-foreground'>
                <Toaster />
                <NativeLifecycle />
                {children}
            </body>
        </html>
    )
}
