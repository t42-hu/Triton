import { test as base, expect } from '@playwright/test'
import { randomUUID } from 'node:crypto'
const api = process.env.TEST_APP_URL
const app = process.env.TEST_NATIVE_URL
const password = 'Disposable-native-browser-2026!'
const test = base.extend({
    native: async ({ context, page }, use) => {
        const vault = new Map()
        const opened = []
        const errors = []
        const requestHeaders = []
        page.on('pageerror', (e) => errors.push(e.message))
        page.on('request', (r) => {
            if (r.url().startsWith(api + '/api/') && ['fetch', 'xhr'].includes(r.resourceType()))
                requestHeaders.push(r.allHeaders())
        })
        await context.exposeBinding('testNativeStorage', (_, operation, key, value) => {
            if (operation === 'get') return vault.get(key) ?? null
            if (operation === 'set') vault.set(key, value)
            if (operation === 'remove') vault.delete(key)
        })
        await context.exposeBinding('testNativeOpen', (_, url) => opened.push(url))
        await context.addInitScript(() => {
            window.fullstackNative = {
                secureStorage: {
                    get: (key) => window.testNativeStorage('get', key),
                    set: (key, value) => window.testNativeStorage('set', key, value),
                    remove: (key) => window.testNativeStorage('remove', key),
                },
                openExternal: (url) => window.testNativeOpen(url),
                onDeepLink: async (callback) => {
                    window.testNativeLink = callback
                    return () => {
                        window.testNativeLink = undefined
                    }
                },
                getLaunchUrl: async () => null,
            }
        })
        await use({
            vault,
            opened,
            token: () => [...vault.entries()].find(([key]) => key.endsWith(':session'))?.[1],
            emit: (url) => page.evaluate((value) => window.testNativeLink(value), url),
        })
        expect(errors, 'No native bundle JavaScript errors').toEqual([])
        for (const headers of await Promise.all(requestHeaders))
            expect(headers.cookie, 'Native API calls must omit browser cookies').toBeUndefined()
    },
})
test.skip(!app, 'Run pnpm test:native to build an isolated native bundle')
test('native profile preserves its session through offline failure and recovery', async ({ page, context, native }) => {
    await page.goto(app + '/register/')
    await register(page, `native-offline-${randomUUID()}@example.test`)
    await expect(page).toHaveURL(/\/profile\/?$/)
    await expect(page.getByLabel('Name', { exact: true })).toHaveValue('Native Browser')
    const token = native.token()
    await context.setOffline(true)
    try {
        await page.getByLabel('Name', { exact: true }).fill('Recovered Native')
        await page.getByRole('button', { name: 'Save profile', exact: true }).click()
        await expect(
            page.getByText('You appear to be offline. Check your connection and try again.', { exact: true }),
        ).toBeVisible()
        expect(native.token()).toBe(token)
    } finally {
        await context.setOffline(false)
    }
    await page.getByRole('button', { name: 'Save profile', exact: true }).click()
    await expect(page.getByText('Profile updated.', { exact: true })).toBeVisible()
})
async function register(page, email) {
    await page.getByLabel('Name', { exact: true }).fill('Native Browser')
    await page.getByLabel('Email', { exact: true }).fill(email)
    await page.getByLabel('Password', { exact: true }).fill(password)
    await page.getByLabel('Confirm password', { exact: true }).fill(password)
    await page.getByRole('button', { name: 'Create account', exact: true }).click()
}
async function logout(page) {
    await page.getByRole('button', { name: 'Log out', exact: true }).click()
    await page.getByRole('alertdialog').getByRole('button', { name: 'Log out', exact: true }).click()
    await expect(page).toHaveURL(/\/login\/?$/)
}
test('static native routes, bearer upload, persistent adapter session, logout and revocation', async ({
    page,
    native,
    request,
}) => {
    await page.goto(app + '/profile/')
    await expect(page).toHaveURL(/\/login\/?$/)
    await page.goto(app + '/register/')
    await register(page, `native-ui-${randomUUID()}@example.test`)
    await expect(page).toHaveURL(/\/profile\/?$/)
    await expect(page.getByLabel('Name', { exact: true })).toHaveValue('Native Browser')
    const token = native.token()
    expect(token).toBeTruthy()
    await page.reload()
    await expect(page.getByLabel('Name', { exact: true })).toHaveValue('Native Browser')
    expect(await page.evaluate(() => JSON.stringify({ ...localStorage, ...sessionStorage }))).not.toContain(token)
    await page.getByLabel('Name', { exact: true }).fill('Native Updated')
    await page.getByLabel('Profile image', { exact: true }).setInputFiles({
        name: 'avatar.png',
        mimeType: 'image/png',
        buffer: Buffer.from(
            'iVBORw0KGgoAAAANSUhEUgAAAAoAAAAKCAIAAAACUFjqAAAACXBIWXMAAAPoAAAD6AG1e1JrAAAAFElEQVQYlWNwaPiPBzGMSjdgCRYAdTWunQSoRsgAAAAASUVORK5CYII=',
            'base64',
        ),
    })
    await page.getByRole('button', { name: 'Save profile', exact: true }).click()
    await expect(page.getByText('Profile updated.', { exact: true })).toBeVisible()
    await page.reload()
    await expect(page.getByLabel('Name', { exact: true })).toHaveValue('Native Updated')
    await expect(page.getByRole('button', { name: 'Remove image' })).toBeEnabled()
    await logout(page)
    expect(native.token()).toBeUndefined()
    expect(
        (
            await request.get(api + '/api/users/me', {
                headers: { Authorization: `Bearer ${token}` },
            })
        ).status(),
    ).toBe(401)
})

test('browser authorization handoff binds state, exchanges once and preserves browser session', async ({
    page,
    browser,
    native,
}) => {
    await page.goto(app + '/login/')
    await page.getByRole('button', { name: 'Continue in browser' }).click()
    await expect.poll(() => native.opened.length).toBe(1)
    const web = await browser.newContext()
    try {
        const browserPage = await web.newPage()
        await browserPage.goto(native.opened[0])
        await browserPage.getByRole('link', { name: 'Create an account', exact: true }).click()
        await expect(browserPage).toHaveURL(/\/register\?redirectTo=/)
        await register(browserPage, `native-oauth-${randomUUID()}@example.test`)
        await expect(browserPage).toHaveURL(/\/native\/connect\?flow=/)
        await browserPage.getByRole('button', { name: 'Authorize app' }).click()
        const link = browserPage.getByRole('link', { name: 'Open app' })
        await expect(link).toBeVisible()
        const callback = await link.getAttribute('href')
        const bad = new URL(callback)
        bad.searchParams.set('state', 'a'.repeat(43))
        await native.emit(bad.toString())
        await expect(page.getByText('Invalid or expired browser sign-in', { exact: true })).toBeVisible()
        await native.emit(callback)
        await expect(page).toHaveURL(/\/profile\/?$/)
        await expect(page.getByLabel('Name', { exact: true })).toHaveValue('Native Browser')
        await native.emit(callback)
        await expect(page.getByText('No browser sign-in is pending', { exact: true })).toBeVisible()
        await logout(page)
        expect((await web.request.get(api + '/api/users/me')).status()).toBe(200)
    } finally {
        await web.close()
    }
})

test('password reset returns through a validated app link and revoked sessions clear from storage', async ({
    page,
    browser,
    request,
    native,
}) => {
    const email = `native-reset-${randomUUID()}@example.test`
    await page.goto(app + '/register/')
    await register(page, email)
    await expect(page).toHaveURL(/\/profile\/?$/)
    await expect(page.getByLabel('Name', { exact: true })).toHaveValue('Native Browser')
    const token = native.token()
    expect(
        (
            await request.post(api + '/api/auth/sign-out', {
                data: {},
                headers: { Origin: app, Authorization: `Bearer ${token}` },
            })
        ).status(),
    ).toBe(200)
    await page.reload()
    await expect(page).toHaveURL(/\/login\/?$/)
    expect(native.token()).toBeUndefined()
    await page.getByRole('link', { name: 'Forgot password?' }).click()
    await expect(page).toHaveURL(/\/forgot-password\/?$/)
    await page.getByLabel('Email', { exact: true }).fill(email)
    await page.getByRole('button', { name: 'Send reset link' }).click()
    await expect(
        page.getByText('If an account exists, reset instructions are on the way.', {
            exact: true,
        }),
    ).toBeVisible()
    let message
    await expect
        .poll(async () => {
            const data = await (await request.get(process.env.TEST_MAIL_URL + '/api/v1/messages')).json()
            message = data.messages.find((m) => m.To.some((t) => t.Address === email))
            return Boolean(message)
        })
        .toBe(true)
    const detail = await (await request.get(`${process.env.TEST_MAIL_URL}/api/v1/message/${message.ID}`)).json()
    const reset = (detail.Text || detail.HTML)
        .match(/https?:[^\s<>"']+\/api\/auth\/reset-password\/[^\s<>"']+/)[0]
        .replaceAll('&amp;', '&')
    const existingSession = await request.post(api + '/api/auth/sign-in/email', {
        headers: { Origin: app },
        data: { email, password },
    })
    expect(existingSession.status()).toBe(200)
    const existingToken = existingSession.headers()['set-auth-token']
    expect(existingToken).toBeTruthy()
    const web = await browser.newPage()
    try {
        await web.goto(reset)
        await expect(web).toHaveURL(/\/native\/reset\?flow=/)
        await web.getByRole('button', { name: 'Continue in app' }).click()
        const link = web.getByRole('link', { name: 'Open app' })
        await expect(link).toBeVisible()
        await native.emit('https://evil.example.test/auth/reset?token=' + 'a'.repeat(32))
        await expect(page.getByText('Invalid application link', { exact: true })).toBeVisible()
        const resetCallback = await link.getAttribute('href')
        expect(new URL(resetCallback).searchParams.has('token')).toBe(false)
        await native.emit(resetCallback)
        await expect(page).toHaveURL(/\/reset-password\/?\?token=/)
        await page.getByLabel('New password', { exact: true }).fill(password + '-new')
        await page.getByLabel('Confirm password', { exact: true }).fill(password + '-new')
        await page.getByRole('button', { name: 'Update password' }).click()
        await expect(page.getByText('Your password has been updated.', { exact: true })).toBeVisible()
        expect(
            (
                await request.get(api + '/api/users/me', {
                    headers: { Authorization: `Bearer ${existingToken}` },
                })
            ).status(),
        ).toBe(401)
        await page.getByRole('link', { name: 'Back to log in' }).click()
        await expect(page).toHaveURL(/\/login\/?$/)
        await page.getByLabel('Email', { exact: true }).fill(email)
        await page.getByLabel('Password', { exact: true }).fill(password + '-new')
        await page.getByRole('button', { name: 'Log in', exact: true }).click()
        await expect(page).toHaveURL(/\/profile\/?$/)
    } finally {
        await web.close()
    }
})
