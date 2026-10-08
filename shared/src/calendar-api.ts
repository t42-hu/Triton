import { z } from 'zod'

export const CalendarIdSchema = z
    .string()
    .min(1)
    .max(128)
    .regex(/^[A-Za-z0-9_-]+$/)
const id = CalendarIdSchema
const name = z.string().trim().min(1).max(200)
const notes = z.string().max(100_000)
const color = z.string().regex(/^#[0-9a-fA-F]{6}$/)
const instant = z.iso.datetime({ offset: true })
const day = z.iso.date()
const timezone = z
    .string()
    .min(1)
    .max(100)
    .refine((value) => {
        try {
            new Intl.DateTimeFormat('en', { timeZone: value })
            return true
        } catch {
            return false
        }
    }, 'Invalid IANA timezone')
const url = z
    .url()
    .max(4096)
    .refine((value) => {
        const parsed = new URL(value)
        return ['https:', 'http:'].includes(parsed.protocol) && !parsed.username && !parsed.password
    }, 'HTTP(S) URL without credentials required')
const occurrence = z.string().max(500)
export const CalendarRoleSchema = z.enum(['reader', 'editor', 'busy_only'])
export const CalendarVersionSchema = z.number().int().positive()
export const CalendarEventInputSchema = z.strictObject({
    id: id.optional(),
    calendarId: id,
    sourceId: id.nullable().optional(),
    externalUid: z.string().min(1).max(500).nullable().optional(),
    title: name,
    notes: notes.optional(),
    location: z.string().max(2000).optional(),
    color: color.nullable().optional(),
    category: z.enum(['lesson', 'event', 'assignment', 'test', 'exam']).optional(),
    kind: z.enum(['timed', 'allDay']).optional(),
    startsAt: instant.nullable().optional(),
    endsAt: instant.nullable().optional(),
    startDate: day.nullable().optional(),
    endDate: day.nullable().optional(),
    timezone: timezone.optional(),
    blocksTime: z.boolean().optional(),
})
const eventFields = {
    title: name.nullable().optional(),
    notes: notes.nullable().optional(),
    location: z.string().max(2000).nullable().optional(),
    startsAt: instant.nullable().optional(),
    endsAt: instant.nullable().optional(),
    startDate: day.nullable().optional(),
    endDate: day.nullable().optional(),
}
const create = <T extends z.ZodRawShape>(shape: T) => z.strictObject({ id: id.optional(), ...shape })
export const CalendarResourceSchemas = {
    calendars: create({
        name,
        description: notes.optional(),
        timezone: timezone.optional(),
        color: color.nullable().optional(),
    }),
    members: create({ calendarId: id, userId: id, role: CalendarRoleSchema }),
    invitations: create({ calendarId: id }),
    profiles: create({ name, isOwn: z.boolean().optional(), linkedUserId: id.nullable().optional() }),
    'profile-calendars': create({ profileId: id, calendarId: id, position: z.number().int().min(0).optional() }),
    'calendar-preferences': create({
        calendarId: id,
        visible: z.boolean().optional(),
        position: z.number().int().min(0).optional(),
        color: color.nullable().optional(),
    }),
    sources: create({
        calendarId: id,
        name,
        format: z.enum(['ics', 'json', 'manual']),
        coverageFrom: day.nullable().optional(),
        coverageTo: day.nullable().optional(),
    }),
    'source-connections': create({ sourceId: id, url: url.nullable().optional(), autoSync: z.boolean().optional() }),
    'source-revisions': create({ sourceId: id }),
    events: CalendarEventInputSchema,
    recurrences: create({
        eventId: id,
        rule: z.string().min(1).max(2000),
        timezone: timezone.optional(),
        untilAt: instant.nullable().optional(),
        anchorDate: day.nullable().optional(),
        anchorWeek: z.enum(['A', 'B']).nullable().optional(),
        weekPattern: z.enum(['all', 'A', 'B']).optional(),
    }),
    exceptions: create({
        eventId: id,
        occurrenceKey: occurrence.min(1),
        canceled: z.boolean().optional(),
        ...eventFields,
        color: color.nullable().optional(),
    }),
    overrides: create({
        eventId: id,
        occurrenceKey: occurrence.optional(),
        ...eventFields,
        hidden: z.boolean().optional(),
    }),
    attachments: create({ eventId: id, occurrenceKey: occurrence.optional(), kind: z.literal('link'), name, url }),
    meetings: create({ eventId: id, status: z.enum(['draft', 'published', 'canceled']).optional() }),
    participants: create({ meetingId: id, userId: id }),
    palettes: create({ name }),
    'palette-colors': create({
        presetId: id,
        role: z.string().min(1).max(100),
        position: z.number().int().min(0).optional(),
        color,
        lightColor: color.nullable().optional(),
        darkColor: color.nullable().optional(),
    }),
    'color-rules': create({
        scope: z.enum(['default', 'calendar', 'series', 'event', 'occurrence']),
        targetKey: z.string().min(1).max(500),
        calendarId: id.nullable().optional(),
        eventId: id.nullable().optional(),
        occurrenceKey: occurrence.nullable().optional(),
        presetId: id.nullable().optional(),
        color: color.nullable().optional(),
        lightColor: color.nullable().optional(),
        darkColor: color.nullable().optional(),
        greenColor: color.nullable().optional(),
        yellowColor: color.nullable().optional(),
        redColor: color.nullable().optional(),
        greenMinutes: z.number().int().min(0).nullable().optional(),
        yellowMinutes: z.number().int().min(0).nullable().optional(),
        redMinutes: z.number().int().min(0).nullable().optional(),
    }),
    tasks: create({
        profileId: id.nullable().optional(),
        title: z.string().trim().min(1).max(500),
        notes: notes.optional(),
        eventId: id.nullable().optional(),
        occurrenceKey: occurrence.nullable().optional(),
        completed: z.boolean().optional(),
        dueAt: instant.nullable().optional(),
        eventTitle: name.nullable().optional(),
    }),
    'notebook-links': create({
        profileId: id.nullable().optional(),
        subjectKey: z.string().max(500).nullable().optional(),
        subject: name.nullable().optional(),
        eventId: id.nullable().optional(),
        occurrenceKey: occurrence.nullable().optional(),
        title: name,
        url,
    }),
    'reminder-settings': create({ enabled: z.boolean() }),
    'event-reminder-settings': create({
        eventId: id,
        occurrenceKey: occurrence.optional(),
        excludeGlobal: z.boolean().optional(),
    }),
    'reminder-rules': create({
        eventId: id.nullable().optional(),
        occurrenceKey: occurrence.optional(),
        minutes: z.number().int().min(1).max(10080),
        profile: z.enum(['gentle', 'standard', 'strong']).optional(),
    }),
    preferences: create({
        theme: z.enum(['system', 'light', 'dark']).optional(),
        timezone: timezone.optional(),
        startupView: z.enum(['today', 'last']).optional(),
        calendarView: z.enum(['day', 'week']).optional(),
        showWeekends: z.boolean().optional(),
        startHour: z.number().int().min(0).max(23).optional(),
        endHour: z.number().int().min(1).max(24).optional(),
        changeNotifications: z.boolean().optional(),
        minimumFreeMinutes: z.number().int().min(1).max(1440).optional(),
        boundFreeTimeToEvents: z.boolean().optional(),
        anchorDate: day.nullable().optional(),
        anchorWeek: z.enum(['A', 'B']).nullable().optional(),
    }),
    devices: create({
        installationId: id,
        platform: z.enum(['web', 'android', 'ios', 'desktop']),
        name: name.nullable().optional(),
        pushToken: z.string().max(4096).nullable().optional(),
    }),
    'device-preferences': create({
        deviceId: id,
        arrangement: z.enum(['row', 'column']).optional(),
        zoomPercent: z.number().int().min(25).max(400).optional(),
        notificationsEnabled: z.boolean().optional(),
        firstImportAt: instant.nullable().optional(),
        batteryPromptShownAt: instant.nullable().optional(),
        quickActions: z
            .array(z.enum(['today', 'calendar', 'tasks', 'new-event']))
            .max(4)
            .optional(),
        viewState: z.record(z.string().max(100), z.json()).optional(),
    }),
} as const
export type CalendarResource = keyof typeof CalendarResourceSchemas
export const CalendarResourceSchema = z.enum(
    Object.keys(CalendarResourceSchemas) as [CalendarResource, ...CalendarResource[]],
)
export const CalendarListSchema = z.strictObject({
    limit: z.coerce.number().int().min(1).max(200).default(100),
    afterId: id.optional(),
    calendarId: id.optional(),
    eventId: id.optional(),
    profileId: id.optional(),
    sourceId: id.optional(),
    meetingId: id.optional(),
    presetId: id.optional(),
    deviceId: id.optional(),
})
export const CalendarDeleteSchema = z.strictObject({ version: CalendarVersionSchema })
export const CalendarInviteSchema = z
    .strictObject({
        calendarId: id,
        userId: id.optional(),
        email: z.email().max(320).optional(),
        role: CalendarRoleSchema,
        expiresInDays: z.number().int().min(1).max(30).default(7),
    })
    .refine((body) => !!body.userId !== !!body.email, 'Specify userId or email')
export const CalendarInviteResponseSchema = z.strictObject({
    version: CalendarVersionSchema,
    response: z.enum(['accepted', 'declined']),
})
export const MeetingCreateSchema = z.strictObject({
    event: CalendarEventInputSchema,
    id: id.optional(),
    status: z.enum(['draft', 'published']).default('published'),
    participantUserIds: z.array(id).max(100).default([]),
})
export const MeetingInviteSchema = z.strictObject({ userIds: z.array(id).min(1).max(100) })
export const MeetingResponseSchema = z.strictObject({
    version: CalendarVersionSchema,
    response: z.enum(['accepted', 'declined', 'tentative']),
})
export const CalendarMutationSchema = z.strictObject({
    clientMutationId: id,
    resource: CalendarResourceSchema,
    operation: z.enum(['create', 'update', 'delete']),
    id: id.optional(),
    version: CalendarVersionSchema.optional(),
    data: z.record(z.string(), z.json()).optional(),
})
export const SyncPushSchema = z.strictObject({
    deviceId: id,
    mutations: z.array(CalendarMutationSchema).min(1).max(100),
})
export const SyncPullSchema = z.strictObject({
    deviceId: id,
    after: z.string().regex(/^\d{1,20}$/),
    limit: z.coerce.number().int().min(1).max(500).default(200),
})
export const SyncSnapshotSchema = z.strictObject({
    deviceId: id,
    snapshotToken: z.string().uuid().optional(),
    offset: z.coerce.number().int().min(0).default(0),
    limit: z.coerce.number().int().min(1).max(200).default(100),
})
export const SyncAckSchema = z.strictObject({
    deviceId: id,
    sequence: z.string().regex(/^\d{1,20}$/),
    snapshotToken: z.string().uuid().optional(),
})
export const ImportPublishSchema = z.strictObject({
    version: CalendarVersionSchema,
    content: z.string().max(1_000_000),
    coverageFrom: day,
    coverageTo: day,
    events: z.array(CalendarEventInputSchema.omit({ id: true, calendarId: true, sourceId: true })).max(5000),
})
export const CalendarRecordSchema = z.record(z.string(), z.json())
export const CalendarListResponseSchema = z.object({ items: z.array(CalendarRecordSchema), nextAfterId: id.nullable() })
export const SyncPushResponseSchema = z.object({
    results: z.array(z.object({ clientMutationId: id, record: CalendarRecordSchema })),
})
