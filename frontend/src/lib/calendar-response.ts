export const MAX_CALENDAR_BYTES = 5 * 1024 * 1024

/** Reads a bounded response and translates known feed errors without exposing private URLs. */
export async function readCalendarResponse(response: Response): Promise<string> {
    if (Number(response.headers.get('content-length')) > MAX_CALENDAR_BYTES)
        throw new Error('A letöltés legfeljebb 5 MB lehet.')
    const reader = response.body?.getReader()
    let content: string
    if (reader) {
        try {
            content = await readChunks(reader)
        } finally {
            await reader.cancel()
        }
    } else {
        content = await response.text()
        if (new TextEncoder().encode(content).byteLength > MAX_CALENDAR_BYTES)
            throw new Error('A letöltés legfeljebb 5 MB lehet.')
    }
    if (!response.ok) {
        if (content.includes('korábbiak érvényüket vesztették'))
            throw new Error(
                'Ez a Neptun-naptárlink már érvénytelen, mert új link készült. Másold be a legutóbb generált linket.',
            )
        throw new Error(`A naptár nem érhető el (HTTP ${response.status}).`)
    }
    if (!/^BEGIN:VCALENDAR\s/im.test(content) || !/END:VCALENDAR\s*$/i.test(content.trim()))
        throw new Error('A link nem teljes ICS naptárat adott vissza.')
    return content
}

async function readChunks(reader: ReadableStreamDefaultReader<Uint8Array>): Promise<string> {
    const decoder = new TextDecoder()
    let size = 0
    let content = ''
    for (;;) {
        const chunk = await reader.read()
        if (chunk.done) return content + decoder.decode()
        size += chunk.value.byteLength
        if (size > MAX_CALENDAR_BYTES) throw new Error('A letöltés legfeljebb 5 MB lehet.')
        content += decoder.decode(chunk.value, { stream: true })
    }
}
