import ProfileCard from '@/components/profile/ProfileCard'
import { profilePageMetadata } from '@/lib/metadata'

export const metadata = profilePageMetadata

export default function ProfilePage() {
    return (
        <div className='mx-auto flex min-h-dvh w-full max-w-6xl items-center justify-center px-6 pb-16 pt-32 sm:pt-28'>
            <ProfileCard />
        </div>
    )
}
