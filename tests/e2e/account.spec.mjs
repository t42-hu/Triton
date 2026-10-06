import { test as base, expect } from '@playwright/test'
import { randomUUID } from 'node:crypto'

const test = base.extend({
    page: async ({ page }, use) => {
        const errors = []
        page.on('pageerror', (error) => errors.push(error.message))
        await use(page)
        expect(errors, 'No uncaught browser errors').toEqual([])
    },
})
const password = 'Disposable-browser-password-2026!'
const email = () => `browser-${randomUUID()}@example.test`
async function register(page, address) {
    await page.goto('/register')
    await page.getByLabel('Name', { exact: true }).fill('Browser Tester')
    await page.getByLabel('Email', { exact: true }).fill(address)
    await page.getByLabel('Password', { exact: true }).fill(password)
    await page.getByLabel('Confirm password', { exact: true }).fill(password)
    await page.getByRole('button', { name: 'Create account', exact: true }).click()
    await expect(page).toHaveURL(/\/profile$/)
    await expect(page.getByLabel('Name', { exact: true })).toHaveValue('Browser Tester')
}
async function logout(page) {
    await page.getByRole('button', { name: 'Log out', exact: true }).click()
    const dialog = page.getByRole('alertdialog')
    await expect(dialog).toBeVisible()
    await dialog.getByRole('button', { name: 'Log out', exact: true }).click()
    await expect(page).toHaveURL(/\/login$/)
}
async function login(page, address, secret = password) {
    await page.goto('/login')
    await page.getByLabel('Email', { exact: true }).fill(address)
    await page.getByLabel('Password', { exact: true }).fill(secret)
    await page.getByRole('button', { name: 'Log in', exact: true }).click()
}
async function noOverflow(page) {
    expect(
        await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1),
        'Page must fit the viewport',
    ).toBe(true)
}

test('home navigation, protected routes, and responsive layout', async ({ page }) => {
    await page.goto('/')
    await expect(
        page.getByRole('heading', {
            name: 'Fullstack Starter',
        }),
    ).toBeVisible()
    await noOverflow(page)
    await page.locator('header a[aria-label$=" home"]').click()
    await expect(page).toHaveURL(new URL('/', process.env.TEST_APP_URL).toString())
    await page.getByRole('link', { name: 'Create an account', exact: true }).click()
    await expect(page.getByRole('button', { name: 'Create account', exact: true })).toBeVisible()
    await noOverflow(page)
    await page.goto('/profile')
    await expect(page).toHaveURL(/\/login\?redirectTo=%2Fprofile$/)
    await expect(page.getByRole('button', { name: 'Log in', exact: true })).toBeVisible()
    await noOverflow(page)
})

test('register, edit and reload profile, upload/remove image, logout and login', async ({ page }) => {
    const address = email()
    await register(page, address)
    await noOverflow(page)
    await page.getByLabel('Name', { exact: true }).fill('Updated Browser Tester')
    // A valid tiny PNG; every run uploads into its own newly generated test account.
    const png = Buffer.from(
        'iVBORw0KGgoAAAANSUhEUgAAAAoAAAAKCAIAAAACUFjqAAAACXBIWXMAAAPoAAAD6AG1e1JrAAAAFElEQVQYlWNwaPiPBzGMSjdgCRYAdTWunQSoRsgAAAAASUVORK5CYII=',
        'base64',
    )
    await page
        .getByLabel('Profile image', { exact: true })
        .setInputFiles({ name: 'avatar.png', mimeType: 'image/png', buffer: png })
    await page.getByRole('button', { name: 'Save profile', exact: true }).click()
    await expect(page.getByText('Profile updated.', { exact: true })).toBeVisible()
    await page.reload()
    await expect(page.getByLabel('Name', { exact: true })).toHaveValue('Updated Browser Tester')
    await expect(page.getByRole('button', { name: 'Remove image', exact: true })).toBeEnabled()
    const profile = await (await page.request.get('/api/users/me')).json()
    expect(profile.profileImage).toContain('/api/files/images/profile-images/')
    expect((await page.request.get(profile.profileImage)).status()).toBe(200)
    await page.getByRole('button', { name: 'Remove image', exact: true }).click()
    await expect(page.getByText('Profile image removed.', { exact: true })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Remove image', exact: true })).toBeDisabled()
    await expect(
        page.getByRole('navigation', { name: 'Primary navigation' }).getByRole('link', { name: /Profile/ }),
    ).toContainText('UB')
    await logout(page)
    expect((await page.request.get('/api/users/me')).status()).toBe(401)
    await login(page, address)
    await expect(page).toHaveURL(/\/profile$/)
    await expect(page.getByLabel('Name', { exact: true })).toHaveValue('Updated Browser Tester')
})

test('password reset email, confirmation validation, new login and single-use token', async ({ page, request }) => {
    const address = email()
    await register(page, address)
    await logout(page)
    await page.getByRole('link', { name: 'Forgot password?', exact: true }).click()
    await expect(page).toHaveURL(/\/forgot-password$/)
    await page.getByLabel('Email', { exact: true }).fill(address)
    await page.getByRole('button', { name: 'Send reset link', exact: true }).click()
    await expect(
        page.getByText('If an account exists, reset instructions are on the way.', {
            exact: true,
        }),
    ).toBeVisible()
    let message
    await expect
        .poll(async () => {
            const response = await request.get(`${process.env.TEST_MAIL_URL}/api/v1/messages`)
            message = (await response.json()).messages.find((m) => m.To.some((t) => t.Address === address))
            return Boolean(message)
        })
        .toBe(true)
    const response = await request.get(`${process.env.TEST_MAIL_URL}/api/v1/message/${message.ID}`)
    const detail = await response.json()
    const link = (detail.Text || detail.HTML)
        .match(/https?:[^\s<>"']+\/api\/auth\/reset-password\/[^\s<>"']+/)?.[0]
        ?.replaceAll('&amp;', '&')
    expect(link).toBeTruthy()
    expect(new URL(link).origin).toBe(new URL(process.env.TEST_APP_URL).origin)
    await page.goto(link)
    const resetUrl = page.url()
    await page.getByLabel('New password', { exact: true }).fill(password + '-new')
    await page.getByLabel('Confirm password', { exact: true }).fill(password + '-different')
    await page.getByRole('button', { name: 'Update password', exact: true }).click()
    await expect(page.getByText('Passwords do not match.', { exact: true })).toBeVisible()
    await page.getByLabel('Confirm password', { exact: true }).fill(password + '-new')
    await page.getByRole('button', { name: 'Update password', exact: true }).click()
    await expect(page.getByText('Your password has been updated.', { exact: true })).toBeVisible()
    await login(page, address)
    await expect(page.getByText('Invalid email or password', { exact: true })).toBeVisible()
    await login(page, address, password + '-new')
    await expect(page).toHaveURL(/\/profile$/)
    await logout(page)
    await page.goto(resetUrl)
    await page.getByLabel('New password', { exact: true }).fill(password + '-again')
    await page.getByLabel('Confirm password', { exact: true }).fill(password + '-again')
    await page.getByRole('button', { name: 'Update password', exact: true }).click()
    await expect(
        page.getByText('Could not reset your password. Please request a new link.', { exact: true }),
    ).toBeVisible()
})

test('registration validation and invalid reset links are actionable', async ({ page }) => {
    await page.goto('/register')
    await page.getByLabel('Name', { exact: true }).fill('Validation Test')
    await page.getByLabel('Email', { exact: true }).fill(email())
    await page.getByLabel('Password', { exact: true }).fill(password)
    await page.getByLabel('Confirm password', { exact: true }).fill(password + 'different')
    await page.getByRole('button', { name: 'Create account', exact: true }).click()
    await expect(page.getByText('Passwords do not match.', { exact: true })).toBeVisible()
    await page.goto('/reset-password')
    await expect(page.getByText(/This reset link is invalid or expired/)).toBeVisible()
    await page.getByRole('link', { name: 'Request a new link', exact: true }).click()
    await expect(page).toHaveURL(/\/forgot-password$/)
})

test('non-JSON server failures and offline state are actionable', async ({ page, context }) => {
    await register(page, email())
    await page.route('**/api/users/me', async (route) => {
        if (route.request().method() !== 'GET') return route.continue()
        return route.fulfill({
            status: 502,
            contentType: 'text/plain',
            body: 'upstream proxy unavailable',
        })
    })
    await page.reload()
    await expect(page.getByText('Request failed with status 502', { exact: true })).toBeVisible()
    await page.unroute('**/api/users/me')

    await page.route('**/api/users/me', async (route) => {
        if (route.request().method() !== 'GET') return route.continue()
        return route.fulfill({
            status: 200,
            contentType: 'application/json',
            headers: { 'x-request-id': 'malformed-profile-1' },
            body: JSON.stringify({ unexpected: true }),
        })
    })
    await page.reload()
    await expect(
        page.getByText(
            'The server returned an unexpected response. Please try again. (Reference: malformed-profile-1)',
            { exact: true },
        ),
    ).toBeVisible()
    await page.unroute('**/api/users/me')

    await context.setOffline(true)
    try {
        await page.getByLabel('Name', { exact: true }).fill('Offline Update')
        await page.getByRole('button', { name: 'Save profile', exact: true }).click()
        await expect(
            page.getByText('You appear to be offline. Check your connection and try again.', { exact: true }),
        ).toBeVisible()
    } finally {
        await context.setOffline(false)
    }
})

test('a stalled profile request times out and leaves the form usable', async ({ page }) => {
    await register(page, email())
    await page.route('**/api/users/me', async (route) => {
        if (route.request().method() !== 'PATCH') await route.continue()
        // Deliberately leave the mutation unanswered to exercise the real deadline.
    })
    await page.getByRole('button', { name: 'Save profile', exact: true }).click()
    await expect(
        page.getByText('The request took too long. Check your connection and try again.', { exact: true }),
    ).toBeVisible({ timeout: 20000 })
    await expect(page.getByRole('button', { name: 'Save profile', exact: true })).toBeEnabled()
})
