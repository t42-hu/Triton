import ICAL from 'ical.js'
export type EventCategory = 'lesson' | 'event' | 'work' | 'assignment' | 'test' | 'exam'
export type DateRange = { from: string; to: string }
export type ImportControl = { signal: AbortSignal; progress: (count: number) => void }
export type Occurrence = {
    key: string
    title: string
    originalTitle: string
    start: number
    end: number
    location: string
    notes?: string
    kind: 'timed' | 'allDay'
    category?: EventCategory
}
export const TIME_ZONE = 'Europe/Budapest'
const formatter = new Intl.DateTimeFormat('sv-SE', {
    timeZone: TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
})

/** Formats an instant in the institution's timezone, independently of the device. */
export function wallTime(timestamp: number): string {
    return formatter.format(new Date(timestamp)).replace(' ', 'T')
}

/** Validates a calendar date without allowing JavaScript date rollover. */
export function validDate(value: string): boolean {
    return (
        /^\d{4}-\d{2}-\d{2}$/.test(value) &&
        Number.isFinite(Date.parse(value)) &&
        new Date(value).toISOString().slice(0, 10) === value
    )
}

/** Converts Budapest wall time; nonexistent DST times fail, repeated times use the earlier instant. */
export function fromWall(value: string): number {
    const normalized = value.length === 10 ? `${value}T00:00:00` : value.slice(0, 19).padEnd(19, ':00')
    const pseudo = Date.parse(`${normalized}Z`)
    if (!Number.isFinite(pseudo) || !validDate(normalized.slice(0, 10)))
        throw new Error('Érvénytelen dátum vagy időpont.')
    const candidates = [2, 1].map((offset) => pseudo - offset * 3600000)
    const match = candidates.find((candidate) => wallTime(candidate) === normalized)
    if (match === undefined)
        throw new Error('Nem létező budapesti időpont (óraátállítás), vagy nem támogatott történelmi dátum.')
    return match
}

/** Adds calendar days without drifting at daylight-saving boundaries. */
export function addDays(date: string, amount: number): string {
    return new Date(Date.parse(`${date}T12:00:00Z`) + amount * 86400000).toISOString().slice(0, 10)
}

export function validateRange(from: string, to: string): void {
    if (!validDate(from) || !validDate(to) || from > to) throw new Error('Érvényes kezdő- és záródátum szükséges.')
}
async function checkpoint(control: ImportControl, count: number): Promise<void> {
    if (control.signal.aborted) throw new Error('Import megszakítva.')
    if (count > 2000000) throw new Error('Az ismétlődés túl sok lépést igényel.')
    if (count % 100 !== 0) return
    control.progress(count)
    await new Promise((resolve) => setTimeout(resolve, 0))
}
function intersects(item: Occurrence, range: DateRange): boolean {
    return (
        item.start < fromWall(addDays(range.to, 1)) &&
        (item.end > fromWall(range.from) || (item.start === item.end && item.start >= fromWall(range.from)))
    )
}
const EVENT_CATEGORIES = ['lesson', 'event', 'work', 'assignment', 'test', 'exam'].map((value) => ({
    value: value as EventCategory,
}))
function isWageTrackrUid(uid: unknown): boolean {
    return typeof uid === 'string' && /@wagetrackr\.eu$/i.test(uid)
}
function importedCategory(title: string): EventCategory {
    const text = title.normalize('NFD').replace(/\p{M}/gu, '').toLocaleLowerCase('hu')
    if (/\bvizsga\b/.test(text)) return 'exam'
    if (/\b(?:zh|zarthelyi)\b/.test(text)) return 'test'
    if (/\bbeadando\b/.test(text)) return 'assignment'
    return 'lesson'
}
function instant(time: ICAL.Time): number {
    if (time.isDate || time.zone.tzid === 'floating') return fromWall(time.toString())
    return time.toUnixTime() * 1000
}
function ensureTimezone(component: ICAL.Component): void {
    for (const property of component.getAllProperties()) {
        const timezone = property.getParameter('tzid')
        if (typeof timezone === 'string' && !component.parent.getTimeZoneByID(timezone) && timezone !== 'UTC')
            throw new Error(`Hiányzó VTIMEZONE: ${timezone}`)
    }
}
function validateComponent(component: ICAL.Component): void {
    ensureTimezone(component)
    if (!component.getFirstPropertyValue('uid')) throw new Error('Hiányzó ICS UID.')
    if (!component.hasProperty('dtstart')) throw new Error('Hiányzó ICS DTSTART.')
    if (component.hasProperty('dtend') && component.hasProperty('duration'))
        throw new Error('DTEND és DURATION egyszerre nem használható.')
    const event = new ICAL.Event(component)
    if (!event.isRecurrenceException() && !event.summary?.trim()) throw new Error('Hiányzó eseménynév.')
    if (!Number.isFinite(instant(event.startDate)) || instant(event.endDate) < instant(event.startDate))
        throw new Error('Hibás ICS időtartam.')
}
function toOccurrence(event: ICAL.Event, original?: ICAL.Time): Occurrence | undefined {
    const details = original ? event.getOccurrenceDetails(original) : undefined
    const item = details?.item ?? event
    if (item.component.getFirstPropertyValue('status') === 'CANCELLED') return undefined
    const startDate = details?.startDate ?? item.startDate
    const endDate = details?.endDate ?? item.endDate
    const title = item.summary || event.summary
    if (!title?.trim()) throw new Error('Hiányzó eseménynév.')
    return {
        key: JSON.stringify([event.uid, original ? `${original.toString()}@${original.zone.tzid}` : 'once']),
        title,
        originalTitle: title,
        start: instant(startDate),
        end: instant(endDate),
        location: item.location || event.location || '',
        notes: String(
            item.component.getFirstPropertyValue('description') ??
                event.component.getFirstPropertyValue('description') ??
                '',
        ),
        kind: startDate.isDate ? 'allDay' : 'timed',
        category: calendarCategory(item.component, title),
    }
}
function latestOriginal(event: ICAL.Event, end: number): number {
    const exceptions = Object.values(event.exceptions)
    const originals = exceptions.map((item) => instant(item.recurrenceId))
    const shifts = exceptions.map((item) => instant(item.startDate) - instant(item.recurrenceId))
    return Math.max(end - Math.min(0, ...shifts), ...originals)
}
async function* expandEvent(event: ICAL.Event, range: DateRange, control: ImportControl): AsyncGenerator<Occurrence> {
    if (!event.isRecurring()) {
        const item = toOccurrence(event)
        if (item && intersects(item, range)) yield item
        return
    }
    const periods = normalizePeriods(event.component)
    const startProperty = new ICAL.Property('rdate')
    startProperty.resetType(event.startDate.isDate ? 'date' : 'date-time')
    startProperty.setValue(event.startDate)
    event.component.addProperty(startProperty)
    const iterator = event.iterator()
    const limit = latestOriginal(event, fromWall(addDays(range.to, 1)))
    let count = 0
    const seen = new Set<string>()
    for (let time = iterator.next(); time; time = iterator.next()) {
        await checkpoint(control, ++count)
        if (instant(time) > limit) break
        const item = toOccurrence(event, time)
        const periodEnd = periods.get(time.toString())
        if (
            item &&
            periodEnd !== undefined &&
            !event.findRangeException(time) &&
            !Object.hasOwn(event.exceptions, time.toString())
        )
            item.end = periodEnd
        if (!item || !intersects(item, range) || seen.has(item.key)) continue
        seen.add(item.key)
        yield item
    }
}
/** Parses RFC calendar components; source errors abort the entire staged import. */
export async function* expandIcs(
    content: string,
    range: DateRange,
    control: ImportControl,
): AsyncGenerator<Occurrence> {
    validateRange(range.from, range.to)
    if (!/^BEGIN:VCALENDAR\s/im.test(content) || !/END:VCALENDAR\s*$/i.test(content.trim()))
        throw new Error('A link nem teljes ICS naptárat adott vissza.')
    const calendar = ICAL.Component.fromString(content)
    if (calendar.name !== 'vcalendar') throw new Error('VCALENDAR fájl szükséges.')
    const components = calendar.getAllSubcomponents('vevent')
    components.forEach(validateComponent)
    const events = components.map((component) => new ICAL.Event(component))
    const keys = events.map((event) => `${event.uid}:${event.recurrenceId?.toString() ?? 'master'}`)
    if (new Set(keys).size !== keys.length) throw new Error('Ismétlődő ICS-azonosító.')
    const masters = events.filter((event) => !event.isRecurrenceException())
    const masterIds = new Set(masters.map((event) => event.uid))
    if (events.some((event) => event.isRecurrenceException() && !masterIds.has(event.uid)))
        throw new Error('A kivételhez hiányzik az eredeti sorozat.')
    for (const event of masters) yield* expandEvent(event, range, control)
}

/** Preserves explicit RDATE period durations while letting ICAL expand their start dates. */
function normalizePeriods(component: ICAL.Component): Map<string, number> {
    const ends = new Map<string, number>()
    for (const property of component.getAllProperties('rdate').filter((item) => item.type === 'period')) {
        const values: unknown[] = property.getValues()
        const periods = values.map((value) => {
            if (!(value instanceof ICAL.Period)) throw new Error('Hibás RDATE periódus.')
            if (instant(value.getEnd()) <= instant(value.start)) throw new Error('Hibás RDATE időtartam.')
            ends.set(value.start.toString(), instant(value.getEnd()))
            return value.start
        })
        property.resetType('date-time')
        property.setValues(periods)
    }
    return ends
}

/** Preserves Triton categories through export without guessing from renamed titles. */
function calendarCategory(component: ICAL.Component, title: string) {
    if (isWageTrackrUid(component.getFirstPropertyValue('uid'))) return 'work'
    const value = component.getFirstPropertyValue('x-triton-category')
    return EVENT_CATEGORIES.find((category) => category.value === value)?.value ?? importedCategory(title)
}
