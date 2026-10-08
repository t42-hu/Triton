import { downloadNeptunCalendar } from '@/lib/calendar-import'

export const runtime = 'nodejs'
const headers = { 'Cache-Control': 'no-store', 'Referrer-Policy': 'no-referrer' }

/** POST keeps private calendar tokens out of request URLs and access logs. */
export async function POST(request: Request) {
    try {
        const origin = request.headers.get('origin')
        if (origin && new URL(origin).host !== (request.headers.get('host') || new URL(request.url).host))
            return Response.json({ error: 'Nem engedélyezett kérés.' }, { status: 403, headers })
        if (Number(request.headers.get('content-length')) > 4096)
            return Response.json({ error: 'Túl hosszú naptárlink.' }, { status: 413, headers })
        const body = await request.text()
        if (body.length > 4096) return Response.json({ error: 'Túl hosszú naptárlink.' }, { status: 413, headers })
        const { url } = JSON.parse(body) as { url?: unknown }
        const content = await downloadNeptunCalendar(url, request.signal)
        return new Response(content, { headers: { ...headers, 'Content-Type': 'text/calendar; charset=utf-8' } })
    } catch (error) {
        const message =
            error instanceof Error && /^(Ez a Neptun|A naptár|A link|A letöltés|Érvénytelen Neptun)/.test(error.message)
                ? error.message
                : 'A naptár letöltése nem sikerült. Próbáld újra később.'
        return Response.json({ error: message }, { status: 400, headers })
    }
}
