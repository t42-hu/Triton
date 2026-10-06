import { createServer } from 'node:http'
import { readFile, stat } from 'node:fs/promises'
import { extname, resolve, sep } from 'node:path'
const types = {
    '.html': 'text/html; charset=utf-8',
    '.js': 'application/javascript',
    '.css': 'text/css',
    '.json': 'application/json',
    '.txt': 'text/plain',
    '.svg': 'image/svg+xml',
    '.png': 'image/png',
    '.woff2': 'font/woff2',
}
export async function serveStatic(root, port = 0) {
    const server = createServer(async (request, response) => {
        try {
            const pathname = decodeURIComponent(new URL(request.url, 'http://localhost').pathname)
            let path = resolve(root, `.${pathname}`)
            if (path !== root && !path.startsWith(root + sep)) throw new Error()
            if ((await stat(path)).isDirectory()) path = resolve(path, 'index.html')
            response.setHeader('Content-Type', types[extname(path)] || 'application/octet-stream')
            response.setHeader('Cache-Control', 'no-store')
            response.setHeader('X-Content-Type-Options', 'nosniff')
            response.end(await readFile(path))
        } catch {
            response.writeHead(404).end('Not found')
        }
    })
    await new Promise((ok, fail) => {
        server.once('error', fail)
        server.listen(port, '127.0.0.1', ok)
    })
    return server
}
