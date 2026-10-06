/* eslint-disable @typescript-eslint/no-require-imports -- Electron's sandboxed preload uses CommonJS. */
const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('fullstackNative', {
    secureStorage: {
        get: (key) => ipcRenderer.invoke('native:storage:get', key),
        set: (key, value) => ipcRenderer.invoke('native:storage:set', key, value),
        remove: (key) => ipcRenderer.invoke('native:storage:remove', key),
    },
    openExternal: (url) => ipcRenderer.invoke('native:open-external', url),
    onDeepLink: async (listener) => {
        const handler = (_event, url) => listener(url)
        ipcRenderer.on('native:deep-link', handler)
        return () => ipcRenderer.removeListener('native:deep-link', handler)
    },
    getLaunchUrl: () => ipcRenderer.invoke('native:get-launch-url'),
})
