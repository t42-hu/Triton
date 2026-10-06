import { defineConfig, devices } from '@playwright/test'
import { resolve } from 'node:path'
if (!process.env.TEST_RUN_ID?.startsWith('fullstack-test-') || !process.env.TEST_APP_URL)
    throw new Error('Use pnpm test:e2e or pnpm test:integration to create an isolated test deployment.')
const artifacts = process.env.TEST_ARTIFACTS
export default defineConfig({
    testDir: './tests/e2e',
    fullyParallel: false,
    workers: 1,
    forbidOnly: !!process.env.CI,
    retries: 0,
    timeout: 45_000,
    expect: { timeout: 10_000 },
    outputDir: resolve(artifacts, 'playwright'),
    reporter: [
        ['list'],
        ['html', { outputFolder: resolve(artifacts, 'report'), open: 'never' }],
        ['junit', { outputFile: resolve(artifacts, 'results.xml') }],
    ],
    use: {
        baseURL: process.env.TEST_APP_URL,
        trace: 'retain-on-failure',
        screenshot: 'only-on-failure',
        video: 'retain-on-failure',
        actionTimeout: 15_000,
        ...(process.env.TEST_BROWSER_WS_ENDPOINT
            ? {
                  connectOptions: {
                      wsEndpoint: process.env.TEST_BROWSER_WS_ENDPOINT,
                      exposeNetwork: '<loopback>',
                  },
              }
            : {}),
    },
    projects: [
        { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
        { name: 'firefox', use: { ...devices['Desktop Firefox'] } },
        { name: 'mobile-webkit', use: { ...devices['iPhone 13'] } },
    ],
})
