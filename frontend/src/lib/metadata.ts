import type { Metadata } from 'next'
import { siteDescription, siteName, siteUrl } from './constants'

export const rootMetadata: Metadata = {
    metadataBase: new URL(siteUrl),
    applicationName: siteName,
    title: { default: siteName, template: `%s | ${siteName}` },
    description: siteDescription,
    keywords: ['full-stack starter', 'Next.js', 'NestJS', 'TypeScript', 'Docker'],
    authors: [{ name: siteName, url: siteUrl }],
    creator: siteName,
    publisher: siteName,
    icons: {
        icon: '/favicon.svg',
        shortcut: '/favicon.svg',
        apple: '/favicon.svg',
    },
    alternates: { canonical: '/' },
    openGraph: {
        type: 'website',
        locale: 'en_US',
        url: '/',
        siteName,
        title: siteName,
        description: siteDescription,
    },
    twitter: { card: 'summary', title: siteName, description: siteDescription },
    robots: { index: true, follow: true },
}

export const homePageMetadata: Metadata = {
    title: siteName,
    description: siteDescription,
    alternates: { canonical: '/' },
}

export const loginPageMetadata: Metadata = {
    title: 'Log in',
    description: `Log in to ${siteName}.`,
    alternates: { canonical: '/login' },
}

export const forgotPasswordPageMetadata: Metadata = {
    title: 'Reset password',
    description: `Request a ${siteName} password reset email.`,
    alternates: { canonical: '/forgot-password' },
}

export const resetPasswordPageMetadata: Metadata = {
    title: 'Choose a new password',
    description: `Reset your ${siteName} password.`,
    alternates: { canonical: '/reset-password' },
}

export const registerPageMetadata: Metadata = {
    title: 'Register',
    description: `Create a ${siteName} account.`,
    alternates: { canonical: '/register' },
}

export const profilePageMetadata: Metadata = {
    title: 'Profile',
    description: `Manage your ${siteName} profile.`,
    alternates: { canonical: '/profile' },
}
