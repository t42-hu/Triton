import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'

export default function ResetPasswordPageSkeleton() {
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
                <div className='flex flex-col gap-3'>
                    {Array.from({ length: 2 }, (_, index) => (
                        <div key={index} className='flex flex-col gap-1.5'>
                            <Skeleton className='h-5 w-32' />
                            <Skeleton className='h-8 rounded-lg' />
                        </div>
                    ))}

                    <Skeleton className='h-8 rounded-lg' />
                </div>

                <Skeleton className='mx-auto h-8 w-40 rounded-lg' />
            </CardContent>
        </Card>
    )
}
