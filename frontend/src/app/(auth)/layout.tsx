export default function AuthLayout({ children }: { children: React.ReactNode }) {
    return (
        <main className='relative min-h-dvh w-full overflow-hidden bg-background'>
            <div className='relative z-10 mx-auto flex min-h-dvh w-full max-w-6xl items-center justify-center px-6 pb-16 pt-32 sm:pt-28'>
                {children}
            </div>
        </main>
    )
}
