import Footer from '@/components/layout/Footer'
import Navbar from '@/components/layout/Navbar'

export default function MainLayout({ children }: { children: React.ReactNode }) {
    return (
        <div className='relative min-h-dvh w-full overflow-hidden bg-background'>
            <Navbar />
            <main className='relative z-10 min-h-dvh w-full'>{children}</main>
            <Footer />
        </div>
    )
}
