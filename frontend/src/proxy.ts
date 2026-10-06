import { getSessionCookie } from 'better-auth/cookies'
import { NextRequest, NextResponse } from 'next/server'

export function proxy(request: NextRequest) {
    const sessionCookie = getSessionCookie(request, {
        cookiePrefix: process.env.NEXT_PUBLIC_APP_ID || 'fullstack-starter',
    })

    if (!sessionCookie) {
        const loginUrl = new URL('/login', request.url)
        loginUrl.searchParams.set('redirectTo', request.nextUrl.pathname)
        return NextResponse.redirect(loginUrl)
    }

    return NextResponse.next()
}

export const config = {
    matcher: ['/profile'],
}
