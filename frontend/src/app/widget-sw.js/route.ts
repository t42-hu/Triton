import { readFile } from 'node:fs/promises'
import { join } from 'node:path'

/** Serve the exported worker at the origin root so the installed PWA covers /. */
export async function GET() {
    const script = await readFile(join(process.cwd(), 'public/triton/widget-sw.js'), 'utf8')
    return new Response(script, {
        headers: { 'Content-Type': 'text/javascript; charset=utf-8', 'Cache-Control': 'no-cache', 'Service-Worker-Allowed': '/' },
    })
}
