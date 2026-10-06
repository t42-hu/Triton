/* eslint-disable @typescript-eslint/no-require-imports -- Electron's main process uses CommonJS. */
const { createHash, randomUUID } = require('node:crypto')
const { existsSync, readFileSync } = require('node:fs')
const { mkdir, readFile, rename, stat, unlink, writeFile } = require('node:fs/promises')
const { isAbsolute, join, relative, resolve } = require('node:path')
const { pathToFileURL } = require('node:url')
const { app, BrowserWindow, ipcMain, net, protocol, safeStorage, session, shell } = require('electron')

const root = resolve(__dirname, '..')
const configFile = resolve(root, '.generated/config.json')
if (!existsSync(configFile)) throw new Error('Run pnpm electron:prepare before starting Electron')
const config = JSON.parse(readFileSync(configFile, 'utf8'))
const renderer = resolve(root, 'renderer')
const appOrigin = 'app://localhost'
const apiOrigin = new URL(config.apiUrl).origin
const socketOrigin = apiOrigin.replace(/^http/, 'ws')
const webOrigin = new URL(config.webUrl).origin
const pendingLinks = []
let mainWindow
let linksReady = false

function isApplicationUrl(value) {
    try {
        const url = new URL(value)
        return url.protocol === 'app:' && url.hostname === 'localhost' && !url.port && !url.username && !url.password
    } catch {
        return false
    }
}

protocol.registerSchemesAsPrivileged([
    { scheme: 'app', privileges: { standard: true, secure: true, supportFetchAPI: true } },
])
app.setName(config.appName)
app.setPath('userData', join(app.getPath('appData'), config.appId))

if (!app.requestSingleInstanceLock()) app.quit()

function deepLink(value) {
    try {
        const url = new URL(value)
        if (url.protocol !== `${config.scheme}:` || !['auth', 'reset'].includes(url.hostname)) return
        if (linksReady && mainWindow && !mainWindow.isDestroyed())
            mainWindow.webContents.send('native:deep-link', value)
        else pendingLinks.push(value)
        mainWindow?.show()
        mainWindow?.focus()
    } catch {
        // Ignore unrelated command-line values.
    }
}

app.on('open-url', (event, url) => {
    event.preventDefault()
    deepLink(url)
})
app.on('second-instance', (_event, commandLine) => {
    for (const value of commandLine) deepLink(value)
})
for (const value of process.argv.slice(1)) deepLink(value)

function externalUrl(value) {
    const url = new URL(value)
    if (url.username || url.password) throw new Error('Browser URL must not contain credentials')
    if (url.protocol === 'https:') return url.toString()
    if (config.development && url.protocol === 'http:' && ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname))
        return url.toString()
    throw new Error('Only HTTPS browser addresses are allowed')
}

async function serve(request) {
    try {
        const url = new URL(request.url)
        if (!isApplicationUrl(request.url)) return new Response('Not found', { status: 404 })
        const pathname = decodeURIComponent(url.pathname)
        let file = resolve(renderer, `.${pathname}`)
        const inside = relative(renderer, file)
        if (inside.startsWith('..') || isAbsolute(inside)) return new Response('Forbidden', { status: 403 })
        const info = await stat(file)
        if (info.isDirectory()) file = join(file, 'index.html')
        return net.fetch(pathToFileURL(file).toString())
    } catch {
        return new Response('Not found', { status: 404 })
    }
}

function storagePath(key) {
    const prefix = `${config.appId}:${config.apiUrl}:`
    if (typeof key !== 'string' || !key.startsWith(prefix) || key.length > prefix.length + 80)
        throw new Error('Invalid native storage key')
    return join(app.getPath('userData'), 'secure-storage', createHash('sha256').update(key).digest('hex'))
}

function requireSecureStorage() {
    if (
        !safeStorage.isEncryptionAvailable() ||
        (process.platform === 'linux' && safeStorage.getSelectedStorageBackend() === 'basic_text')
    )
        throw new Error('An operating system keychain is required for native sessions')
}

function authorize(event) {
    if (event.sender !== mainWindow?.webContents || !isApplicationUrl(event.senderFrame?.url))
        throw new Error('Unauthorized desktop request')
}

ipcMain.handle('native:storage:get', async (event, key) => {
    authorize(event)
    requireSecureStorage()
    try {
        const ciphertext = await readFile(storagePath(key))
        return (await safeStorage.decryptStringAsync(ciphertext)).result
    } catch (error) {
        if (error.code === 'ENOENT') return null
        throw error
    }
})
ipcMain.handle('native:storage:set', async (event, key, value) => {
    authorize(event)
    requireSecureStorage()
    if (typeof value !== 'string' || value.length > 16384) throw new Error('Invalid native storage value')
    const file = storagePath(key)
    await mkdir(resolve(file, '..'), { recursive: true, mode: 0o700 })
    const temporary = `${file}.${randomUUID()}`
    try {
        await writeFile(temporary, await safeStorage.encryptStringAsync(value), { mode: 0o600 })
        await rename(temporary, file)
    } finally {
        await unlink(temporary).catch(() => undefined)
    }
})
ipcMain.handle('native:storage:remove', async (event, key) => {
    authorize(event)
    await unlink(storagePath(key)).catch((error) => {
        if (error.code !== 'ENOENT') throw error
    })
})
ipcMain.handle('native:open-external', async (event, url) => {
    authorize(event)
    await shell.openExternal(externalUrl(url))
})
ipcMain.handle('native:get-launch-url', (event) => {
    authorize(event)
    linksReady = true
    return pendingLinks.shift() || null
})

async function createWindow() {
    mainWindow = new BrowserWindow({
        width: 1180,
        height: 800,
        minWidth: 360,
        minHeight: 540,
        show: false,
        webPreferences: {
            preload: resolve(__dirname, 'preload.cjs'),
            nodeIntegration: false,
            contextIsolation: true,
            sandbox: true,
            webSecurity: true,
        },
    })
    mainWindow.once('ready-to-show', () => mainWindow?.show())
    mainWindow.webContents.setWindowOpenHandler(({ url }) => {
        try {
            void shell.openExternal(externalUrl(url)).catch(() => undefined)
        } catch {
            // Reject privileged or unsupported external protocols.
        }
        return { action: 'deny' }
    })
    mainWindow.webContents.on('will-navigate', (event, url) => {
        if (isApplicationUrl(url)) return
        event.preventDefault()
        try {
            void shell.openExternal(externalUrl(url)).catch(() => undefined)
        } catch {
            // Keep the application renderer on its packaged origin.
        }
    })
    mainWindow.on('closed', () => {
        mainWindow = undefined
        linksReady = false
    })
    await mainWindow.loadURL(`${appOrigin}/`)
}

app.whenReady().then(async () => {
    if (app.isPackaged) app.setAsDefaultProtocolClient(config.scheme)
    protocol.handle('app', serve)
    session.defaultSession.setPermissionRequestHandler((_contents, _permission, callback) => callback(false))
    session.defaultSession.setPermissionCheckHandler(() => false)
    session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
        if (!isApplicationUrl(details.url)) return callback({ responseHeaders: details.responseHeaders })
        callback({
            responseHeaders: {
                ...details.responseHeaders,
                'Content-Security-Policy': [
                    `default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; connect-src 'self' ${apiOrigin} ${socketOrigin}; img-src 'self' data: blob: https: ${apiOrigin}; font-src 'self' data:; frame-src 'none'; object-src 'none'; base-uri 'none'; form-action 'self' ${webOrigin}`,
                ],
            },
        })
    })
    await createWindow()
})

app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) void createWindow()
})
app.on('window-all-closed', () => app.quit())
