'use client'

import Link from 'next/link'
import Image from 'next/image'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { LuLoaderCircle as LoaderCircleIcon, LuLogIn, LuLogOut } from 'react-icons/lu'

import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogMedia,
    AlertDialogTitle,
    AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import { authClient } from '@/lib/auth-client'
import { useSession } from '@/lib/use-session'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Button, buttonVariants } from '@/components/ui/button'
import { navbarItems, siteName } from '@/lib/constants'

const getInitials = (name?: string | null) =>
    name
        ?.trim()
        .split(/\s+/)
        .slice(0, 2)
        .map((part) => part[0]?.toUpperCase())
        .join('') || 'P'

export default function Navbar() {
    const router = useRouter()
    const { data: session } = useSession()
    const user = session?.user
    const [logoutOpen, setLogoutOpen] = useState(false)
    const [logoutPending, setLogoutPending] = useState(false)
    const [logoutMessage, setLogoutMessage] = useState<string | null>(null)

    const handleLogout = async () => {
        setLogoutPending(true)
        setLogoutMessage(null)

        try {
            const response = await authClient.signOut()

            if (response?.error) {
                setLogoutMessage(response.error.message || 'Could not log out.')
                return
            }

            setLogoutOpen(false)
            router.replace('/login')
        } catch {
            setLogoutMessage('Something went wrong. Please try again.')
        } finally {
            setLogoutPending(false)
        }
    }

    return (
        <header className='fixed inset-x-0 top-0 z-50 w-full border-b border-border bg-background'>
            <div className='mx-auto flex min-h-20 w-full max-w-6xl flex-col gap-4 px-6 py-3 sm:flex-row sm:items-center sm:justify-between sm:gap-8'>
                <Link href='/' aria-label={`${siteName} home`} className='flex shrink-0 items-center'>
                    <Image src='/logo.svg' alt='' width={36} height={36} />
                    <span className='ml-3 font-semibold'>{siteName}</span>
                </Link>

                <nav aria-label='Primary navigation' className='flex flex-wrap items-center gap-3'>
                    {navbarItems.map(({ icon: Icon, ...item }) => (
                        <Link
                            key={item.href}
                            className={buttonVariants({
                                variant: 'secondary',
                                className: 'px-4',
                            })}
                            href={item.href}
                        >
                            <Icon data-icon='inline-start' />
                            {item.label}
                        </Link>
                    ))}
                    {user ? (
                        <>
                            <Link
                                className={buttonVariants({
                                    variant: 'secondary',
                                    className: 'px-4',
                                })}
                                href='/profile'
                            >
                                <Avatar size='sm' className='mr-1'>
                                    {user.image && <AvatarImage src={user.image} alt='' />}
                                    <AvatarFallback>{getInitials(user.name)}</AvatarFallback>
                                </Avatar>
                                Profile
                            </Link>
                            <AlertDialog open={logoutOpen} onOpenChange={setLogoutOpen}>
                                <AlertDialogTrigger asChild>
                                    <Button variant='secondary' className='px-4'>
                                        <LuLogOut data-icon='inline-start' />
                                        Log out
                                    </Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent size='sm'>
                                    <AlertDialogHeader>
                                        <AlertDialogMedia>
                                            <LuLogOut />
                                        </AlertDialogMedia>
                                        <AlertDialogTitle>Log out?</AlertDialogTitle>
                                        <AlertDialogDescription>
                                            You will need to log in again before changing your profile or using account
                                            features.
                                        </AlertDialogDescription>
                                    </AlertDialogHeader>
                                    {logoutMessage && (
                                        <p className='rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive'>
                                            {logoutMessage}
                                        </p>
                                    )}
                                    <AlertDialogFooter>
                                        <AlertDialogCancel disabled={logoutPending}>Cancel</AlertDialogCancel>
                                        <AlertDialogAction
                                            variant='destructive'
                                            disabled={logoutPending}
                                            onClick={(event) => {
                                                event.preventDefault()
                                                void handleLogout()
                                            }}
                                        >
                                            {logoutPending ? (
                                                <LoaderCircleIcon data-icon='inline-start' className='animate-spin' />
                                            ) : (
                                                <LuLogOut data-icon='inline-start' />
                                            )}
                                            Log out
                                        </AlertDialogAction>
                                    </AlertDialogFooter>
                                </AlertDialogContent>
                            </AlertDialog>
                        </>
                    ) : (
                        <Link
                            className={buttonVariants({
                                variant: 'secondary',
                                className: 'px-4',
                            })}
                            href='/login'
                        >
                            <LuLogIn data-icon='inline-start' />
                            Login
                        </Link>
                    )}
                </nav>
            </div>
        </header>
    )
}
