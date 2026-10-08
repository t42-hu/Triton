import { z } from 'zod'
import { getTableColumns, getTableName } from 'drizzle-orm'
import type { PgTable } from 'drizzle-orm/pg-core'
import { CalendarResourceSchemas, type CalendarResource } from '@fullstack-starter/shared'
import * as s from '../database/database.schema.js'

export type DomainRow = Record<string, unknown>
export type Access =
    | 'user'
    | 'calendar'
    | 'event'
    | 'calendar-root'
    | 'member'
    | 'invitation'
    | 'source-owner'
    | 'source-revision'
    | 'meeting'
    | 'participant'
export type ResourceDefinition = {
    table: PgTable
    access: Access
    parent?: string
    immutable: string[]
    create?: false
    update?: false
    remove?: false
}
export const resources: Record<CalendarResource, ResourceDefinition> = {
    calendars: { table: s.calendar, access: 'calendar-root', immutable: [] },
    members: { table: s.calendarMember, access: 'member', immutable: ['calendarId', 'userId'], create: false },
    invitations: { table: s.calendarInvitation, access: 'invitation', immutable: [], create: false, update: false },
    profiles: { table: s.scheduleProfile, access: 'user', immutable: [] },
    'profile-calendars': { table: s.scheduleProfileCalendar, access: 'user', immutable: ['profileId', 'calendarId'] },
    'calendar-preferences': { table: s.userCalendarPreference, access: 'user', immutable: ['calendarId'] },
    sources: { table: s.calendarSource, access: 'calendar', parent: 'calendarId', immutable: ['calendarId', 'format'] },
    'source-connections': {
        table: s.calendarSourceConnection,
        access: 'source-owner',
        parent: 'sourceId',
        immutable: ['sourceId'],
    },
    'source-revisions': {
        table: s.calendarSourceRevision,
        access: 'source-revision',
        parent: 'sourceId',
        immutable: [],
        create: false,
        update: false,
        remove: false,
    },
    events: {
        table: s.calendarEvent,
        access: 'event',
        parent: 'calendarId',
        immutable: ['calendarId', 'sourceId', 'externalUid'],
    },
    recurrences: { table: s.eventRecurrence, access: 'event', parent: 'eventId', immutable: ['eventId'] },
    exceptions: {
        table: s.eventException,
        access: 'event',
        parent: 'eventId',
        immutable: ['eventId', 'occurrenceKey'],
    },
    overrides: { table: s.userEventOverride, access: 'user', immutable: ['eventId', 'occurrenceKey'] },
    attachments: {
        table: s.eventAttachment,
        access: 'event',
        parent: 'eventId',
        immutable: ['eventId', 'occurrenceKey', 'kind'],
    },
    meetings: { table: s.meeting, access: 'meeting', immutable: ['eventId'], create: false },
    participants: { table: s.meetingParticipant, access: 'participant', immutable: [], create: false, update: false },
    palettes: { table: s.userColorPreset, access: 'user', immutable: [] },
    'palette-colors': { table: s.userColorPresetColor, access: 'user', immutable: ['presetId', 'role'] },
    'color-rules': {
        table: s.userColorRule,
        access: 'user',
        immutable: ['scope', 'targetKey', 'calendarId', 'eventId', 'occurrenceKey'],
    },
    tasks: { table: s.userTask, access: 'user', immutable: [] },
    'notebook-links': { table: s.userNotebookLink, access: 'user', immutable: [] },
    'reminder-settings': { table: s.userReminderSetting, access: 'user', immutable: [] },
    'event-reminder-settings': {
        table: s.userEventReminderSetting,
        access: 'user',
        immutable: ['eventId', 'occurrenceKey'],
    },
    'reminder-rules': { table: s.userReminderRule, access: 'user', immutable: ['eventId', 'occurrenceKey', 'minutes'] },
    preferences: { table: s.userPreference, access: 'user', immutable: [] },
    devices: { table: s.userDevice, access: 'user', immutable: ['installationId', 'platform'] },
    'device-preferences': { table: s.userDevicePreference, access: 'user', immutable: ['deviceId'] },
}
export const resourceNames = Object.keys(resources) as CalendarResource[]
export const resourceByTable = new Map(resourceNames.map((name) => [getTableName(resources[name].table), name]))
export function tableName(resource: CalendarResource) {
    return getTableName(resources[resource].table)
}
export function columns(resource: CalendarResource) {
    return getTableColumns(resources[resource].table)
}
export function encodeRow(resource: CalendarResource, row: DomainRow): DomainRow {
    const result: DomainRow = {}
    for (const [key, col] of Object.entries(columns(resource))) {
        const value = row[col.name]
        result[key] = value instanceof Date ? value.toISOString() : typeof value === 'bigint' ? value.toString() : value
    }
    // Object keys never confer public access and must not escape API responses.
    delete result.storageKey
    delete result.tokenHash
    return result
}
export function decodeInput(resource: CalendarResource, input: DomainRow): DomainRow {
    const result: DomainRow = {}
    const cols = columns(resource)
    for (const [key, value] of Object.entries(input)) {
        if (cols[key] && value !== undefined)
            result[cols[key].name] = cols[key].dataType === 'json' ? JSON.stringify(value) : value
    }
    return result
}
export function inputSchema(resource: CalendarResource): z.ZodObject<z.ZodRawShape> {
    return CalendarResourceSchemas[resource]
}
