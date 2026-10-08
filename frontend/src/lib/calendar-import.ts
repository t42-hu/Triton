import { readCalendarResponse } from './calendar-response'

/** Only the university's calendar export can be fetched through our server. */
export function neptunCalendarUrl(input: unknown): string {
    if (typeof input !== 'string' || input.length > 2048) throw new Error('Érvénytelen Neptun-naptárlink.')
    const url = new URL(input)
    if (
        url.protocol !== 'https:' ||
        url.hostname !== 'neptun.uni-obuda.hu' ||
        url.port ||
        url.username ||
        url.password ||
        url.hash ||
        url.pathname !== '/ujhallgato/api/Calendar/CalendarExportFileToSyncronization' ||
        [...url.searchParams.keys()].length !== 1 ||
        !/^[a-f0-9]{16,512}\.ics$/i.test(url.searchParams.get('id') || '')
    )
        throw new Error('Érvénytelen Neptun-naptárlink.')
    return url.href
}

export async function downloadNeptunCalendar(input: unknown, signal?: AbortSignal): Promise<string> {
    const url = neptunCalendarUrl(input)
    const response = await fetch(url, {
        redirect: 'error',
        cache: 'no-store',
        credentials: 'omit',
        referrerPolicy: 'no-referrer',
        signal: signal ? AbortSignal.any([signal, AbortSignal.timeout(30000)]) : AbortSignal.timeout(30000),
    })
    return readCalendarResponse(response)
}
