'use client'

import Link from 'next/link'
import Image from 'next/image'
import { buttonVariants } from '@/components/ui/button'
import { footerItems, siteDescription, siteName, siteUrl } from '@/lib/constants'

export default function Footer() {
    const year = new Date().getFullYear()

    return (
        <footer className='relative z-10 w-full border-t border-border bg-background'>
            <div className='mx-auto flex w-full max-w-6xl flex-col gap-10 px-6 py-6'>
                <div className='flex flex-col gap-6 md:flex-row md:items-center md:justify-between'>
                    <div className='flex max-w-md flex-col gap-3'>
                        <Link href='/' aria-label={`${siteName} home`} className='flex w-fit items-center'>
                            <Image src='/logo.svg' alt='' width={32} height={32} />
                            <span className='ml-3 font-semibold'>{siteName}</span>
                        </Link>
                        <p className='max-w-md text-sm leading-6 text-muted-foreground'>{siteDescription}</p>
                    </div>

                    <nav aria-label='Footer navigation' className='flex flex-wrap items-center gap-3'>
                        {footerItems.map(({ icon: Icon, ...item }) => (
                            <Link
                                href={item.href}
                                key={item.href}
                                className={buttonVariants({
                                    variant: 'secondary',
                                    className: 'px-4',
                                })}
                            >
                                <Icon data-icon='inline-start' />
                                {item.label}
                            </Link>
                        ))}
                    </nav>
                </div>
            </div>

            <div className='border-t border-border px-6 py-6 text-xs text-muted-foreground'>
                <div className='mx-auto flex w-full max-w-6xl flex-col gap-2 sm:flex-row sm:items-center sm:justify-between'>
                    <p>
                        © {year} {siteName}.
                    </p>
                    <p>{new URL(siteUrl).host}</p>
                </div>
            </div>
        </footer>
    )
}
