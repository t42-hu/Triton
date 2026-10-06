import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'

const socialButtonSkeletons = Array.from({ length: 4 }, (_, index) => index)

export default function RegisterPageSkeleton() {
    return (
        <Card className='w-sm border-foreground/15 bg-background'>
            <CardHeader>
                <CardTitle className='text-2xl'>
                    <Skeleton className='h-8 w-56' />
                </CardTitle>
                <CardDescription>
                    <Skeleton className='h-5 w-72' />
                </CardDescription>
            </CardHeader>
            <CardContent className='flex flex-col gap-5'>
                <div className='grid grid-cols-1 gap-2'>
                    {socialButtonSkeletons.map((index) => (
                        <Skeleton key={index} className='h-12 rounded-lg' />
                    ))}
                </div>

                <div className='flex items-center gap-3 text-xs text-muted-foreground'>
                    <span className='h-px flex-1 bg-border' />
                    <Skeleton className='h-4 w-5' />
                    <span className='h-px flex-1 bg-border' />
                </div>

                <div className='flex flex-col gap-3'>
                    {Array.from({ length: 4 }, (_, index) => (
                        <div key={index} className='flex flex-col gap-1.5'>
                            <Skeleton className='h-5 w-24' />
                            <Skeleton className='h-8 rounded-lg' />
                        </div>
                    ))}

                    <Skeleton className='h-8 rounded-lg' />
                </div>

                <Skeleton className='mx-auto h-8 w-56 rounded-lg' />
            </CardContent>
        </Card>
    )
}
