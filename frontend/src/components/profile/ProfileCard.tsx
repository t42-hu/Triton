'use client'

import { usePublicConfig } from '@/lib/public-config'
import { useRouter } from 'next/navigation'
import type { ChangeEvent, SubmitEvent } from 'react'
import { useEffect, useState } from 'react'
import { LuImagePlus as ImagePlusIcon, LuLoaderCircle as LoaderCircleIcon, LuTrash2 as TrashIcon } from 'react-icons/lu'
import { ImageContentTypeSchema } from '@fullstack-starter/shared'

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { uploadProfileImage } from '@/lib/api/profile-image'
import { apiErrorMessage } from '@/lib/api/errors'
import { getCurrentUserProfile, updateCurrentUserProfile } from '@/lib/api/user'
import { useSession } from '@/lib/use-session'

export default function ProfileCard() {
    const router = useRouter()
    const publicConfig = usePublicConfig()
    const { data: session, isPending, refetch } = useSession()
    const user = session?.user
    const [name, setName] = useState('')
    const [imageFile, setImageFile] = useState<File | null>(null)
    const [previewUrl, setPreviewUrl] = useState<string | null>(null)
    const [savedImageUrl, setSavedImageUrl] = useState<string | null>(null)
    const [message, setMessage] = useState<string | null>(null)
    const [pending, setPending] = useState(false)

    useEffect(() => {
        if (!isPending && !user) {
            router.replace('/login')
        }
    }, [isPending, router, user])

    useEffect(() => {
        if (!user) {
            return
        }

        let active = true

        setName(user.name ?? '')
        setSavedImageUrl(user.image ?? null)

        void getCurrentUserProfile()
            .then((response) => {
                if (!active) {
                    return
                }

                setName(response.name)
                setSavedImageUrl(response.profileImage)
            })
            .catch((error: unknown) => {
                if (active) setMessage(apiErrorMessage(error, 'Could not load your profile.'))
            })

        return () => {
            active = false
        }
    }, [user])

    useEffect(() => {
        if (!imageFile) {
            setPreviewUrl(null)
            return
        }

        const objectUrl = URL.createObjectURL(imageFile)
        setPreviewUrl(objectUrl)

        return () => URL.revokeObjectURL(objectUrl)
    }, [imageFile])

    const imageUrl = previewUrl || savedImageUrl || undefined

    const handleImageChange = (event: ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0] ?? null

        if (file && !ImageContentTypeSchema.safeParse(file.type).success) {
            setMessage('Choose an image file.')
            event.target.value = ''
            return
        }

        setMessage(null)
        setImageFile(file)
    }

    const handleSubmit = async (event: SubmitEvent<HTMLFormElement>) => {
        event.preventDefault()

        if (!user) {
            return
        }

        const nextName = name.trim()

        if (nextName.length < 2) {
            setMessage('Name must be at least 2 characters.')
            return
        }

        setPending(true)
        setMessage(null)

        try {
            const upload = imageFile ? await uploadProfileImage(imageFile) : null

            const response = await updateCurrentUserProfile({
                name: nextName,
                ...(upload ? { imageKey: upload.key } : {}),
            })

            setSavedImageUrl(response.profileImage)
            setImageFile(null)
            await refetch()
            setMessage('Profile updated.')
        } catch (error) {
            setMessage(apiErrorMessage(error, 'Something went wrong. Please try again.'))
        } finally {
            setPending(false)
        }
    }

    const handleRemoveImage = async () => {
        setPending(true)
        setMessage(null)

        try {
            await updateCurrentUserProfile({ imageKey: null })

            setSavedImageUrl(null)
            setImageFile(null)
            await refetch()
            setMessage('Profile image removed.')
        } catch (error) {
            setMessage(apiErrorMessage(error, 'Something went wrong. Please try again.'))
        } finally {
            setPending(false)
        }
    }

    if (isPending || !user) return <p role='status'>Checking your account…</p>

    return (
        <Card className='w-full max-w-xl border-foreground/15 bg-background'>
            <CardHeader>
                <CardTitle className='text-2xl'>Profile</CardTitle>
                <CardDescription>Rename yourself and update your image.</CardDescription>
            </CardHeader>
            <CardContent>
                <form onSubmit={handleSubmit} className='flex flex-col gap-5'>
                    <div className='flex flex-col gap-4 sm:flex-row sm:items-center'>
                        <label className='group relative block cursor-pointer'>
                            <input
                                aria-label='Profile image'
                                accept={ImageContentTypeSchema.options.join(',')}
                                disabled={pending || !publicConfig?.features.uploads}
                                onChange={handleImageChange}
                                type='file'
                                className='hidden'
                            />

                            <Avatar className='size-24 overflow-hidden rounded-2xl border border-border'>
                                {imageUrl && (
                                    <AvatarImage
                                        src={imageUrl}
                                        alt=''
                                        className='transition duration-200 group-hover:blur-[2px]'
                                    />
                                )}

                                <AvatarFallback className='rounded-2xl'>
                                    {user?.name.slice(0, 2).toUpperCase()}
                                </AvatarFallback>
                            </Avatar>

                            <div className='absolute inset-0 flex items-center justify-center rounded-2xl bg-black/40 opacity-0 backdrop-blur-[1px] transition-opacity duration-200 group-hover:opacity-100'>
                                <ImagePlusIcon className='size-7 text-white' />
                            </div>
                        </label>

                        <div className='flex flex-col gap-1'>
                            <p className='text-sm font-medium'>Profile image</p>
                            <p className='text-sm text-muted-foreground'>
                                {publicConfig?.features.uploads
                                    ? 'Click the image to upload a new image.'
                                    : 'Image uploads are unavailable.'}
                            </p>
                        </div>
                    </div>

                    <label className='flex flex-col gap-1.5 text-sm font-medium'>
                        Name
                        <Input
                            autoComplete='name'
                            disabled={pending}
                            minLength={2}
                            onChange={(event) => setName(event.target.value)}
                            required
                            value={name}
                        />
                    </label>

                    {message && (
                        <p className='rounded-md border border-border bg-muted/50 px-3 py-2 text-sm'>{message}</p>
                    )}

                    <div className='flex flex-col gap-2 sm:flex-row'>
                        <Button type='submit' disabled={pending}>
                            {pending ? (
                                <LoaderCircleIcon data-icon='inline-start' className='animate-spin' />
                            ) : (
                                <ImagePlusIcon data-icon='inline-start' />
                            )}
                            Save profile
                        </Button>
                        <Button
                            type='button'
                            variant='outline'
                            disabled={pending || !publicConfig?.features.uploads || (!savedImageUrl && !imageFile)}
                            onClick={handleRemoveImage}
                        >
                            <TrashIcon data-icon='inline-start' />
                            Remove image
                        </Button>
                    </div>
                </form>
            </CardContent>
        </Card>
    )
}
