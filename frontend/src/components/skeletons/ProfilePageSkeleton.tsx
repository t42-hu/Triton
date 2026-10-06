import { Skeleton } from '@/components/ui/skeleton'

export default function ProfilePageSkeleton() {
    return (
        <div className='mx-auto flex min-h-dvh w-full max-w-6xl items-center justify-center px-6 pb-16 pt-32 sm:pt-28'>
            <div className='flex w-full max-w-xl flex-col gap-5 rounded-xl bg-card p-4 ring-1 ring-foreground/10'>
                <div className='space-y-2'>
                    <Skeleton className='h-7 w-28' />
                    <Skeleton className='h-4 w-72' />
                </div>
                <div className='flex flex-col gap-4 sm:flex-row sm:items-center'>
                    <Skeleton className='size-24 rounded-2xl' />
                    <div className='flex flex-1 flex-col gap-2'>
                        <Skeleton className='h-5 w-32' />
                        <Skeleton className='h-4 w-64' />
                    </div>
                </div>
                <Skeleton className='h-8 w-full rounded-lg' />
                <div className='flex flex-col gap-2 sm:flex-row'>
                    <Skeleton className='h-8 w-28 rounded-lg' />
                    <Skeleton className='h-8 w-36 rounded-lg' />
                </div>
            </div>
        </div>
    )
}
