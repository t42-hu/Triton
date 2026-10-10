export type SharedEvent = { id: string; category: string; title: string; location: string; notes: string;
    kind: string; starts_at: Date | null; ends_at: Date | null; start_date: string | null; end_date: string | null }
function escapeText(value: string) {
    return value.replace(/\\/g, '\\\\').replace(/\r\n|\r|\n/g, '\\n').replace(/,/g, '\\,').replace(/;/g, '\\;')
}
function utcDate(value: Date) { return new Date(value).toISOString().replace(/[-:]/g, '').slice(0,15) + 'Z' }
function fold(line: string) {
    let width = 0, result = ''
    for (const character of line) {
        const bytes = Buffer.byteLength(character)
        if (width + bytes > 75) { result += '\r\n '; width = 1 }
        result += character; width += bytes
    }
    return result
}
/** Shares only timetable fields, with stable UIDs and exclusive all-day end dates. */
export function serializeSharedCalendar(name: string, events: SharedEvent[], now = new Date()) {
    const lines = ['BEGIN:VCALENDAR','VERSION:2.0','PRODID:-//Triton42//Shared timetable//HU','CALSCALE:GREGORIAN',`X-WR-CALNAME:${escapeText(name)}`]
    for (const event of events) {
        if (event.kind === 'allDay' ? !event.start_date || !event.end_date : !event.starts_at || !event.ends_at) continue
        lines.push('BEGIN:VEVENT',`UID:${encodeURIComponent(event.id)}@triton42.hu`,`DTSTAMP:${utcDate(now)}`,
            ...(event.kind === 'allDay' ? [`DTSTART;VALUE=DATE:${event.start_date!.replace(/-/g,'')}`,`DTEND;VALUE=DATE:${event.end_date!.replace(/-/g,'')}`] :
                [`DTSTART:${utcDate(event.starts_at!)}`,`DTEND:${utcDate(event.ends_at!)}`]),
            `SUMMARY:${escapeText(event.title)}`,`LOCATION:${escapeText(event.location)}`,`DESCRIPTION:${escapeText(event.notes)}`,
            `X-TRITON-CATEGORY:${escapeText(event.category)}`,'END:VEVENT')
    }
    return [...lines,'END:VCALENDAR'].map(fold).join('\r\n')+'\r\n'
}
