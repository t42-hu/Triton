import { LuHouse } from 'react-icons/lu'

const normalizeUrl = (value: string) => value.replace(/\/$/, '')

export const siteName = process.env.NEXT_PUBLIC_APP_NAME?.trim() || 'Fullstack Starter'
const publicDomain = process.env.NEXT_PUBLIC_APP_DOMAIN?.trim()
export const siteUrl = normalizeUrl(
    publicDomain ? `https://${publicDomain}` : process.env.NEXT_PUBLIC_APP_URL?.trim() || 'http://localhost',
)
export const siteDescription = process.env.NEXT_PUBLIC_APP_DESCRIPTION?.trim() || 'Your application starts here.'

export const navbarItems = [{ icon: LuHouse, label: 'Home', href: '/' }]

export const footerItems = [{ icon: LuHouse, label: 'Home', href: '/' }]
