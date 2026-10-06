/* eslint-disable @typescript-eslint/no-require-imports -- electron-builder loads this file as CommonJS. */
const { readFileSync } = require('node:fs')
const { resolve } = require('node:path')

const config = JSON.parse(readFileSync(resolve(__dirname, '.generated/config.json'), 'utf8'))

module.exports = {
    appId: config.bundleId,
    productName: config.appName,
    executableName: config.appId,
    extraMetadata: { name: config.appId, version: config.appVersion, homepage: config.webUrl },
    directories: { output: 'out' },
    files: ['src/**', 'renderer/**', '.generated/config.json', 'package.json'],
    asar: true,
    protocols: [{ name: config.appName, schemes: [config.scheme] }],
    mac: { target: ['dmg', 'zip'], category: 'public.app-category.productivity', icon: '.generated/icon.png' },
    win: { target: ['nsis'], icon: '.generated/icon.png' },
    linux: {
        target: ['AppImage', 'deb'],
        category: 'Utility',
        icon: '.generated/icon.png',
        maintainer: config.maintainer,
    },
}
