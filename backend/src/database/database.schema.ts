import { sql } from 'drizzle-orm'
import {
    bigint,
    bigserial,
    boolean,
    check,
    date,
    foreignKey,
    index,
    integer,
    jsonb,
    pgTable,
    text,
    timestamp,
    unique,
    uniqueIndex,
} from 'drizzle-orm/pg-core'

export const session = pgTable('session', {
    id: text('id').primaryKey(),
    userId: text('user_id')
        .notNull()
        .references(() => user.id, { onDelete: 'cascade' }),
    token: text('token').notNull().unique(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    ipAddress: text('ip_address'),
    userAgent: text('user_agent'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull(),
})

export const account = pgTable(
    'account',
    {
        id: text('id').primaryKey(),
        userId: text('user_id')
            .notNull()
            .references(() => user.id, { onDelete: 'cascade' }),
        accountId: text('account_id').notNull(),
        providerId: text('provider_id').notNull(),
        accessToken: text('access_token'),
        refreshToken: text('refresh_token'),
        idToken: text('id_token'),
        accessTokenExpiresAt: timestamp('access_token_expires_at', {
            withTimezone: true,
        }),
        refreshTokenExpiresAt: timestamp('refresh_token_expires_at', {
            withTimezone: true,
        }),
        scope: text('scope'),
        password: text('password'),
        createdAt: timestamp('created_at', { withTimezone: true }).notNull(),
        updatedAt: timestamp('updated_at', { withTimezone: true }).notNull(),
    },
    (t) => [unique('account_provider_identity').on(t.providerId, t.accountId), index('account_user_idx').on(t.userId)],
)

export const verification = pgTable('verification', {
    id: text('id').primaryKey(),
    identifier: text('identifier').notNull(),
    value: text('value').notNull(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull(),
})

export const user = pgTable(
    'user',
    {
        id: text('id').primaryKey(),
        name: text('name').notNull(),
        email: text('email').notNull().unique(),
        emailVerified: boolean('email_verified').default(false).notNull(),
        role: text('role').default('user').notNull(),
        profileImage: text('profile_image'),
        twoFactorEnabled: boolean('two_factor_enabled').default(false).notNull(),
        createdAt: timestamp('created_at', { withTimezone: true }).notNull(),
        updatedAt: timestamp('updated_at', { withTimezone: true }).notNull(),
    },
    (t) => [uniqueIndex('user_email_normalized_unique').on(sql`lower(trim(${t.email}))`)],
)

export const billingCustomer = pgTable('billing_customer', {
    userId: text('user_id')
        .primaryKey()
        .references(() => user.id, { onDelete: 'cascade' }),
    stripeCustomerId: text('stripe_customer_id').notNull().unique(),
})

export const paymentEvent = pgTable('payment_event', {
    id: text('id').primaryKey(),
    type: text('type').notNull(),
    payload: jsonb('payload').notNull(),
    receivedAt: timestamp('received_at', { withTimezone: true }).notNull().defaultNow(),
    processedAt: timestamp('processed_at', { withTimezone: true }),
})

export const payment = pgTable('payment', {
    checkoutSessionId: text('checkout_session_id').primaryKey(),
    userId: text('user_id')
        .notNull()
        .references(() => user.id, { onDelete: 'cascade' }),
    stripeCustomerId: text('stripe_customer_id'),
    status: text('status').notNull(),
    currency: text('currency'),
    amountTotal: text('amount_total'),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
})

// Domain IDs also accept client-generated UUIDs, allowing offline creation.
const record = () => ({
    id: text('id')
        .primaryKey()
        .default(sql`gen_random_uuid()::text`),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
    version: integer('version').notNull().default(1),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
})
const userRef = (name = 'user_id') =>
    text(name)
        .notNull()
        .references(() => user.id, { onDelete: 'cascade' })
const calendarRef = () =>
    text('calendar_id')
        .notNull()
        .references(() => calendar.id, { onDelete: 'cascade' })
const eventRef = () =>
    text('event_id')
        .notNull()
        .references(() => calendarEvent.id, { onDelete: 'cascade' })

export const calendar = pgTable(
    'calendar',
    {
        ...record(),
        ownerUserId: userRef('owner_user_id'),
        name: text('name').notNull(),
        description: text('description').notNull().default(''),
        timezone: text('timezone').notNull().default('Europe/Budapest'),
        color: text('color'),
    },
    (t) => [
        index('calendar_owner_idx').on(t.ownerUserId),
        check('calendar_color_check', sql`${t.color} ~ '^#[0-9A-Fa-f]{6}$'`),
        check('calendar_name_check', sql`length(trim(${t.name})) > 0`),
    ],
)

export const calendarMember = pgTable(
    'calendar_member',
    {
        ...record(),
        calendarId: calendarRef(),
        userId: userRef(),
        role: text('role').notNull().default('reader'),
    },
    (t) => [
        unique('calendar_member_pair').on(t.calendarId, t.userId),
        index('calendar_member_user_idx').on(t.userId),
        check('calendar_member_role_check', sql`${t.role} IN ('reader','editor','busy_only')`),
    ],
)

export const calendarInvitation = pgTable(
    'calendar_invitation',
    {
        ...record(),
        calendarId: calendarRef(),
        invitedByUserId: userRef('invited_by_user_id'),
        invitedUserId: text('invited_user_id').references(() => user.id, { onDelete: 'cascade' }),
        invitedEmail: text('invited_email'),
        tokenHash: text('token_hash').notNull().unique(),
        role: text('role').notNull().default('reader'),
        status: text('status').notNull().default('pending'),
        expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
        respondedAt: timestamp('responded_at', { withTimezone: true }),
    },
    (t) => [
        index('calendar_invitation_calendar_idx').on(t.calendarId),
        index('calendar_invitation_recipient_idx').on(t.invitedUserId),
        check(
            'calendar_invitation_recipient_check',
            sql`${t.invitedUserId} IS NOT NULL OR (${t.invitedEmail} IS NOT NULL AND length(trim(${t.invitedEmail})) > 0)`,
        ),
        check('calendar_invitation_role_check', sql`${t.role} IN ('reader','editor','busy_only')`),
        check(
            'calendar_invitation_status_check',
            sql`${t.status} IN ('pending','accepted','declined','revoked','expired')`,
        ),
    ],
)

export const scheduleProfile = pgTable(
    'schedule_profile',
    {
        ...record(),
        userId: userRef(),
        name: text('name').notNull(),
        isOwn: boolean('is_own').notNull().default(false),
        linkedUserId: text('linked_user_id').references(() => user.id, { onDelete: 'set null' }),
    },
    (t) => [
        unique('schedule_profile_owner_pair').on(t.id, t.userId),
        index('schedule_profile_user_idx').on(t.userId),
        uniqueIndex('schedule_profile_one_own')
            .on(t.userId)
            .where(sql`${t.isOwn} AND ${t.deletedAt} IS NULL`),
    ],
)

export const scheduleProfileCalendar = pgTable(
    'schedule_profile_calendar',
    {
        ...record(),
        userId: userRef(),
        profileId: text('profile_id').notNull(),
        calendarId: calendarRef(),
        position: integer('position').notNull().default(0),
    },
    (t) => [
        unique('schedule_profile_calendar_pair').on(t.profileId, t.calendarId),
        foreignKey({
            columns: [t.profileId, t.userId],
            foreignColumns: [scheduleProfile.id, scheduleProfile.userId],
        }).onDelete('cascade'),
        index('schedule_profile_calendar_calendar_idx').on(t.calendarId),
    ],
)

export const userCalendarPreference = pgTable(
    'user_calendar_preference',
    {
        ...record(),
        userId: userRef(),
        calendarId: calendarRef(),
        visible: boolean('visible').notNull().default(true),
        position: integer('position').notNull().default(0),
        color: text('color'),
    },
    (t) => [
        unique('user_calendar_preference_pair').on(t.userId, t.calendarId),
        check('user_calendar_preference_color_check', sql`${t.color} ~ '^#[0-9A-Fa-f]{6}$'`),
    ],
)

export const calendarSource = pgTable(
    'calendar_source',
    {
        ...record(),
        calendarId: calendarRef(),
        name: text('name').notNull(),
        format: text('format').notNull(),
        coverageFrom: date('coverage_from'),
        coverageTo: date('coverage_to'),
    },
    (t) => [
        unique('calendar_source_calendar_pair').on(t.id, t.calendarId),
        index('calendar_source_calendar_idx').on(t.calendarId),
        check('calendar_source_format_check', sql`${t.format} IN ('ics','json','manual')`),
        check(
            'calendar_source_coverage_check',
            sql`(${t.coverageFrom} IS NULL AND ${t.coverageTo} IS NULL) OR (${t.coverageFrom} IS NOT NULL AND ${t.coverageTo} IS NOT NULL AND ${t.coverageTo} >= ${t.coverageFrom})`,
        ),
    ],
)

// Private connection metadata must never be returned to shared-calendar readers.
export const calendarSourceConnection = pgTable(
    'calendar_source_connection',
    {
        ...record(),
        sourceId: text('source_id')
            .notNull()
            .references(() => calendarSource.id, { onDelete: 'cascade' })
            .unique(),
        url: text('url'),
        autoSync: boolean('auto_sync').notNull().default(false),
        etag: text('etag'),
        lastModified: text('last_modified'),
        importedAt: timestamp('imported_at', { withTimezone: true }).notNull().defaultNow(),
        lastAttemptAt: timestamp('last_attempt_at', { withTimezone: true }),
        lastSuccessAt: timestamp('last_success_at', { withTimezone: true }),
        lastError: text('last_error'),
        lastChange: text('last_change'),
    },
    (t) => [check('calendar_source_connection_auto_check', sql`NOT ${t.autoSync} OR ${t.url} IS NOT NULL`)],
)

export const calendarSourceRevision = pgTable(
    'calendar_source_revision',
    {
        ...record(),
        sourceId: text('source_id')
            .notNull()
            .references(() => calendarSource.id, { onDelete: 'cascade' }),
        contentHash: text('content_hash').notNull(),
        storageKey: text('storage_key').notNull(),
        isCurrent: boolean('is_current').notNull().default(false),
    },
    (t) => [
        unique('calendar_source_revision_source_pair').on(t.sourceId, t.id),
        index('calendar_source_revision_source_idx').on(t.sourceId),
        uniqueIndex('calendar_source_revision_one_current')
            .on(t.sourceId)
            .where(sql`${t.isCurrent} AND ${t.deletedAt} IS NULL`),
    ],
)

export const calendarEvent = pgTable(
    'calendar_event',
    {
        ...record(),
        calendarId: calendarRef(),
        sourceId: text('source_id'),
        externalUid: text('external_uid'),
        title: text('title').notNull(),
        notes: text('notes').notNull().default(''),
        location: text('location').notNull().default(''),
        color: text('color'),
        category: text('category').notNull().default('event'),
        kind: text('kind').notNull().default('timed'),
        startsAt: timestamp('starts_at', { withTimezone: true }),
        endsAt: timestamp('ends_at', { withTimezone: true }),
        startDate: date('start_date'),
        endDate: date('end_date'),
        timezone: text('timezone').notNull().default('Europe/Budapest'),
        blocksTime: boolean('blocks_time').notNull().default(true),
        createdByUserId: text('created_by_user_id').references(() => user.id, { onDelete: 'set null' }),
    },
    (t) => [
        foreignKey({
            columns: [t.sourceId, t.calendarId],
            foreignColumns: [calendarSource.id, calendarSource.calendarId],
        }),
        index('calendar_event_window_idx').on(t.calendarId, t.startsAt, t.endsAt),
        index('calendar_event_dates_idx').on(t.calendarId, t.startDate, t.endDate),
        uniqueIndex('calendar_event_source_uid')
            .on(t.sourceId, t.externalUid)
            .where(sql`${t.externalUid} IS NOT NULL`),
        check('calendar_event_title_check', sql`length(trim(${t.title})) > 0`),
        check('calendar_event_color_check', sql`${t.color} ~ '^#[0-9A-Fa-f]{6}$'`),
        check('calendar_event_category_check', sql`${t.category} IN ('lesson','event','work','assignment','test','exam')`),
        check(
            'calendar_event_time_check',
            sql`(${t.kind} = 'timed' AND ${t.startsAt} IS NOT NULL AND ${t.endsAt} IS NOT NULL AND ${t.endsAt} > ${t.startsAt} AND ${t.startDate} IS NULL AND ${t.endDate} IS NULL) OR (${t.kind} = 'allDay' AND ${t.startDate} IS NOT NULL AND ${t.endDate} IS NOT NULL AND ${t.endDate} > ${t.startDate} AND ${t.startsAt} IS NULL AND ${t.endsAt} IS NULL)`,
        ),
    ],
)

export const eventRecurrence = pgTable(
    'event_recurrence',
    {
        ...record(),
        eventId: eventRef().unique(),
        rule: text('rule').notNull(),
        timezone: text('timezone').notNull().default('Europe/Budapest'),
        untilAt: timestamp('until_at', { withTimezone: true }),
        anchorDate: date('anchor_date'),
        anchorWeek: text('anchor_week'),
        weekPattern: text('week_pattern').notNull().default('all'),
    },
    (t) => [
        check(
            'event_recurrence_week_check',
            sql`${t.weekPattern} IN ('all','A','B') AND (${t.anchorWeek} IS NULL OR ${t.anchorWeek} IN ('A','B')) AND (${t.weekPattern} = 'all' OR (${t.anchorDate} IS NOT NULL AND ${t.anchorWeek} IS NOT NULL))`,
        ),
    ],
)

// occurrenceKey is the ORIGINAL recurrence identity, unchanged when the time moves.
export const eventException = pgTable(
    'event_exception',
    {
        ...record(),
        eventId: eventRef(),
        occurrenceKey: text('occurrence_key').notNull(),
        canceled: boolean('canceled').notNull().default(false),
        title: text('title'),
        notes: text('notes'),
        location: text('location'),
        color: text('color'),
        startsAt: timestamp('starts_at', { withTimezone: true }),
        endsAt: timestamp('ends_at', { withTimezone: true }),
        startDate: date('start_date'),
        endDate: date('end_date'),
    },
    (t) => [
        unique('event_exception_occurrence_pair').on(t.eventId, t.occurrenceKey),
        check('event_exception_color_check', sql`${t.color} ~ '^#[0-9A-Fa-f]{6}$'`),
        check(
            'event_exception_time_check',
            sql`((${t.startsAt} IS NULL AND ${t.endsAt} IS NULL) OR (${t.startsAt} IS NOT NULL AND ${t.endsAt} IS NOT NULL AND ${t.endsAt} > ${t.startsAt})) AND ((${t.startDate} IS NULL AND ${t.endDate} IS NULL) OR (${t.startDate} IS NOT NULL AND ${t.endDate} IS NOT NULL AND ${t.endDate} > ${t.startDate})) AND NOT (${t.startsAt} IS NOT NULL AND ${t.startDate} IS NOT NULL)`,
        ),
    ],
)

export const userEventOverride = pgTable(
    'user_event_override',
    {
        ...record(),
        userId: userRef(),
        eventId: eventRef(),
        occurrenceKey: text('occurrence_key').notNull().default(''),
        title: text('title'),
        notes: text('notes'),
        location: text('location'),
        hidden: boolean('hidden').notNull().default(false),
        startsAt: timestamp('starts_at', { withTimezone: true }),
        endsAt: timestamp('ends_at', { withTimezone: true }),
        startDate: date('start_date'),
        endDate: date('end_date'),
    },
    (t) => [
        unique('user_event_override_target').on(t.userId, t.eventId, t.occurrenceKey),
        check(
            'user_event_override_time_check',
            sql`((${t.startsAt} IS NULL AND ${t.endsAt} IS NULL) OR (${t.startsAt} IS NOT NULL AND ${t.endsAt} IS NOT NULL AND ${t.endsAt} > ${t.startsAt})) AND ((${t.startDate} IS NULL AND ${t.endDate} IS NULL) OR (${t.startDate} IS NOT NULL AND ${t.endDate} IS NOT NULL AND ${t.endDate} > ${t.startDate})) AND NOT (${t.startsAt} IS NOT NULL AND ${t.startDate} IS NOT NULL)`,
        ),
    ],
)

export const eventAttachment = pgTable(
    'event_attachment',
    {
        ...record(),
        eventId: eventRef(),
        occurrenceKey: text('occurrence_key').notNull().default(''),
        uploadedByUserId: text('uploaded_by_user_id').references(() => user.id, { onDelete: 'set null' }),
        kind: text('kind').notNull(),
        name: text('name').notNull(),
        storageKey: text('storage_key'),
        url: text('url'),
        mimeType: text('mime_type'),
        sizeBytes: bigint('size_bytes', { mode: 'bigint' }),
        contentHash: text('content_hash'),
    },
    (t) => [
        index('event_attachment_event_idx').on(t.eventId),
        check(
            'event_attachment_payload_check',
            sql`(${t.kind} = 'file' AND ${t.storageKey} IS NOT NULL AND ${t.url} IS NULL AND ${t.mimeType} IS NOT NULL AND ${t.sizeBytes} IS NOT NULL AND ${t.sizeBytes} >= 0) OR (${t.kind} = 'link' AND ${t.url} IS NOT NULL AND ${t.url} ~* '^https?://' AND ${t.storageKey} IS NULL AND ${t.sizeBytes} IS NULL)`,
        ),
    ],
)

export const meeting = pgTable(
    'meeting',
    {
        ...record(),
        eventId: eventRef().unique(),
        organizerUserId: userRef('organizer_user_id'),
        status: text('status').notNull().default('draft'),
    },
    (t) => [
        index('meeting_organizer_idx').on(t.organizerUserId),
        check('meeting_status_check', sql`${t.status} IN ('draft','published','canceled')`),
    ],
)

export const meetingParticipant = pgTable(
    'meeting_participant',
    {
        ...record(),
        meetingId: text('meeting_id')
            .notNull()
            .references(() => meeting.id, { onDelete: 'cascade' }),
        userId: userRef(),
        invitedByUserId: text('invited_by_user_id').references(() => user.id, { onDelete: 'set null' }),
        response: text('response').notNull().default('pending'),
        respondedAt: timestamp('responded_at', { withTimezone: true }),
    },
    (t) => [
        unique('meeting_participant_pair').on(t.meetingId, t.userId),
        index('meeting_participant_user_idx').on(t.userId),
        check(
            'meeting_participant_response_check',
            sql`${t.response} IN ('pending','accepted','declined','tentative')`,
        ),
    ],
)

export const userColorPreset = pgTable(
    'user_color_preset',
    {
        ...record(),
        userId: userRef(),
        name: text('name').notNull(),
    },
    (t) => [
        unique('user_color_preset_owner_pair').on(t.id, t.userId),
        index('user_color_preset_user_idx').on(t.userId),
    ],
)

export const userColorPresetColor = pgTable(
    'user_color_preset_color',
    {
        ...record(),
        userId: userRef(),
        presetId: text('preset_id').notNull(),
        role: text('role').notNull(),
        position: integer('position').notNull().default(0),
        color: text('color').notNull(),
        lightColor: text('light_color'),
        darkColor: text('dark_color'),
    },
    (t) => [
        foreignKey({
            columns: [t.presetId, t.userId],
            foreignColumns: [userColorPreset.id, userColorPreset.userId],
        }).onDelete('cascade'),
        unique('user_color_preset_color_role').on(t.presetId, t.role),
        check(
            'user_color_preset_color_check',
            sql`${t.color} ~ '^#[0-9A-Fa-f]{6}$' AND (${t.lightColor} IS NULL OR ${t.lightColor} ~ '^#[0-9A-Fa-f]{6}$') AND (${t.darkColor} IS NULL OR ${t.darkColor} ~ '^#[0-9A-Fa-f]{6}$')`,
        ),
    ],
)

export const userColorRule = pgTable(
    'user_color_rule',
    {
        ...record(),
        userId: userRef(),
        scope: text('scope').notNull(),
        targetKey: text('target_key').notNull(),
        calendarId: text('calendar_id').references(() => calendar.id, { onDelete: 'cascade' }),
        eventId: text('event_id').references(() => calendarEvent.id, { onDelete: 'cascade' }),
        occurrenceKey: text('occurrence_key'),
        presetId: text('preset_id'),
        color: text('color'),
        lightColor: text('light_color'),
        darkColor: text('dark_color'),
        greenColor: text('green_color'),
        yellowColor: text('yellow_color'),
        redColor: text('red_color'),
        greenMinutes: integer('green_minutes'),
        yellowMinutes: integer('yellow_minutes'),
        redMinutes: integer('red_minutes'),
    },
    (t) => [
        unique('user_color_rule_target').on(t.userId, t.scope, t.targetKey),
        foreignKey({ columns: [t.presetId, t.userId], foreignColumns: [userColorPreset.id, userColorPreset.userId] }),
        check(
            'user_color_rule_scope_check',
            sql`(${t.scope} = 'default' AND ${t.calendarId} IS NULL AND ${t.eventId} IS NULL AND ${t.occurrenceKey} IS NULL) OR (${t.scope} IN ('calendar','series') AND ${t.calendarId} IS NOT NULL AND ${t.eventId} IS NULL AND ${t.occurrenceKey} IS NULL) OR (${t.scope} = 'event' AND ${t.eventId} IS NOT NULL AND ${t.calendarId} IS NULL AND ${t.occurrenceKey} IS NULL) OR (${t.scope} = 'occurrence' AND ${t.eventId} IS NOT NULL AND ${t.calendarId} IS NULL AND ${t.occurrenceKey} IS NOT NULL AND length(${t.occurrenceKey}) > 0)`,
        ),
        check(
            'user_color_rule_colors_check',
            sql`(${t.color} IS NULL OR ${t.color} ~ '^#[0-9A-Fa-f]{6}$') AND (${t.lightColor} IS NULL OR ${t.lightColor} ~ '^#[0-9A-Fa-f]{6}$') AND (${t.darkColor} IS NULL OR ${t.darkColor} ~ '^#[0-9A-Fa-f]{6}$')`,
        ),
        check(
            'user_color_rule_urgency_check',
            sql`(${t.greenColor} IS NULL AND ${t.yellowColor} IS NULL AND ${t.redColor} IS NULL AND ${t.greenMinutes} IS NULL AND ${t.yellowMinutes} IS NULL AND ${t.redMinutes} IS NULL) OR (${t.greenColor} IS NOT NULL AND ${t.yellowColor} IS NOT NULL AND ${t.redColor} IS NOT NULL AND ${t.greenColor} ~ '^#[0-9A-Fa-f]{6}$' AND ${t.yellowColor} ~ '^#[0-9A-Fa-f]{6}$' AND ${t.redColor} ~ '^#[0-9A-Fa-f]{6}$' AND ${t.yellowMinutes} IS NOT NULL AND ${t.redMinutes} IS NOT NULL AND ${t.redMinutes} >= 0 AND ${t.yellowMinutes} > ${t.redMinutes} AND (${t.greenMinutes} IS NULL OR ${t.greenMinutes} > ${t.yellowMinutes}))`,
        ),
    ],
)

export const userTask = pgTable(
    'user_task',
    {
        ...record(),
        userId: userRef(),
        profileId: text('profile_id'),
        title: text('title').notNull(),
        notes: text('notes').notNull().default(''),
        eventId: text('event_id').references(() => calendarEvent.id, { onDelete: 'set null' }),
        occurrenceKey: text('occurrence_key'),
        completed: boolean('completed').notNull().default(false),
        dueAt: timestamp('due_at', { withTimezone: true }),
        eventTitle: text('event_title'),
    },
    (t) => [
        foreignKey({ columns: [t.profileId, t.userId], foreignColumns: [scheduleProfile.id, scheduleProfile.userId] }),
        index('user_task_due_idx').on(t.userId, t.completed, t.dueAt),
        check('user_task_title_check', sql`length(trim(${t.title})) > 0`),
    ],
)

export const userNotebookLink = pgTable(
    'user_notebook_link',
    {
        ...record(),
        userId: userRef(),
        profileId: text('profile_id'),
        subjectKey: text('subject_key'),
        subject: text('subject'),
        eventId: text('event_id').references(() => calendarEvent.id, { onDelete: 'set null' }),
        occurrenceKey: text('occurrence_key'),
        title: text('title').notNull(),
        url: text('url').notNull(),
    },
    (t) => [
        foreignKey({ columns: [t.profileId, t.userId], foreignColumns: [scheduleProfile.id, scheduleProfile.userId] }),
        index('user_notebook_link_subject_idx').on(t.userId, t.subjectKey),
        check('user_notebook_link_url_check', sql`${t.url} ~* '^https?://'`),
    ],
)

export const userReminderSetting = pgTable('user_reminder_setting', {
    ...record(),
    userId: userRef().unique(),
    enabled: boolean('enabled').notNull().default(false),
})

export const userEventReminderSetting = pgTable(
    'user_event_reminder_setting',
    {
        ...record(),
        userId: userRef(),
        eventId: eventRef(),
        occurrenceKey: text('occurrence_key').notNull().default(''),
        excludeGlobal: boolean('exclude_global').notNull().default(false),
    },
    (t) => [unique('user_event_reminder_setting_target').on(t.userId, t.eventId, t.occurrenceKey)],
)

export const userReminderRule = pgTable(
    'user_reminder_rule',
    {
        ...record(),
        userId: userRef(),
        eventId: text('event_id').references(() => calendarEvent.id, { onDelete: 'cascade' }),
        occurrenceKey: text('occurrence_key').notNull().default(''),
        minutes: integer('minutes').notNull(),
        profile: text('profile').notNull().default('standard'),
    },
    (t) => [
        uniqueIndex('user_reminder_rule_global')
            .on(t.userId, t.minutes)
            .where(sql`${t.eventId} IS NULL AND ${t.deletedAt} IS NULL`),
        uniqueIndex('user_reminder_rule_event')
            .on(t.userId, t.eventId, t.occurrenceKey, t.minutes)
            .where(sql`${t.eventId} IS NOT NULL AND ${t.deletedAt} IS NULL`),
        check('user_reminder_rule_minutes_check', sql`${t.minutes} BETWEEN 1 AND 10080`),
        check('user_reminder_rule_profile_check', sql`${t.profile} IN ('gentle','standard','strong')`),
        check('user_reminder_rule_target_check', sql`${t.eventId} IS NOT NULL OR ${t.occurrenceKey} = ''`),
    ],
)

export const userPreference = pgTable(
    'user_preference',
    {
        ...record(),
        userId: userRef().unique(),
        theme: text('theme').notNull().default('system'),
        timezone: text('timezone').notNull().default('Europe/Budapest'),
        startupView: text('startup_view').notNull().default('today'),
        calendarView: text('calendar_view').notNull().default('week'),
        showWeekends: boolean('show_weekends').notNull().default(true),
        startHour: integer('start_hour').notNull().default(7),
        endHour: integer('end_hour').notNull().default(20),
        changeNotifications: boolean('change_notifications').notNull().default(false),
        minimumFreeMinutes: integer('minimum_free_minutes').notNull().default(30),
        boundFreeTimeToEvents: boolean('bound_free_time_to_events').notNull().default(true),
        anchorDate: date('anchor_date'),
        anchorWeek: text('anchor_week'),
    },
    (t) => [
        check('user_preference_theme_check', sql`${t.theme} IN ('system','light','dark')`),
        check(
            'user_preference_view_check',
            sql`${t.startupView} IN ('today','last') AND ${t.calendarView} IN ('day','week')`,
        ),
        check(
            'user_preference_hours_check',
            sql`${t.startHour} >= 0 AND ${t.endHour} <= 24 AND ${t.endHour} > ${t.startHour}`,
        ),
        check('user_preference_free_minutes_check', sql`${t.minimumFreeMinutes} > 0`),
        check(
            'user_preference_anchor_check',
            sql`(${t.anchorDate} IS NULL AND ${t.anchorWeek} IS NULL) OR (${t.anchorDate} IS NOT NULL AND ${t.anchorWeek} IS NOT NULL AND ${t.anchorWeek} IN ('A','B'))`,
        ),
    ],
)

export const userDevice = pgTable(
    'user_device',
    {
        ...record(),
        userId: userRef(),
        installationId: text('installation_id').notNull(),
        platform: text('platform').notNull(),
        name: text('name'),
        pushToken: text('push_token'),
        lastSeenAt: timestamp('last_seen_at', { withTimezone: true }).notNull().defaultNow(),
        revokedAt: timestamp('revoked_at', { withTimezone: true }),
    },
    (t) => [
        unique('user_device_installation_pair').on(t.userId, t.installationId),
        unique('user_device_owner_pair').on(t.id, t.userId),
        check('user_device_platform_check', sql`${t.platform} IN ('web','android','ios','desktop')`),
    ],
)

export const userDevicePreference = pgTable(
    'user_device_preference',
    {
        ...record(),
        userId: userRef(),
        deviceId: text('device_id').notNull().unique(),
        arrangement: text('arrangement').notNull().default('column'),
        zoomPercent: integer('zoom_percent').notNull().default(100),
        notificationsEnabled: boolean('notifications_enabled').notNull().default(true),
        firstImportAt: timestamp('first_import_at', { withTimezone: true }),
        batteryPromptShownAt: timestamp('battery_prompt_shown_at', { withTimezone: true }),
        quickActions: jsonb('quick_actions')
            .$type<string[]>()
            .notNull()
            .default(sql`'[]'::jsonb`),
        viewState: jsonb('view_state')
            .$type<Record<string, unknown>>()
            .notNull()
            .default(sql`'{}'::jsonb`),
    },
    (t) => [
        foreignKey({ columns: [t.deviceId, t.userId], foreignColumns: [userDevice.id, userDevice.userId] }).onDelete(
            'cascade',
        ),
        check('user_device_preference_arrangement_check', sql`${t.arrangement} IN ('row','column')`),
        check('user_device_preference_zoom_check', sql`${t.zoomPercent} BETWEEN 25 AND 400`),
        check(
            'user_device_preference_json_check',
            sql`jsonb_typeof(${t.quickActions}) = 'array' AND jsonb_typeof(${t.viewState}) = 'object'`,
        ),
    ],
)

// No content payload or FKs: deletion notices survive removal of their parent records.
export const syncChange = pgTable(
    'sync_change',
    {
        sequence: bigserial('sequence', { mode: 'bigint' }).primaryKey(),
        entityType: text('entity_type').notNull(),
        entityId: text('entity_id').notNull(),
        operation: text('operation').notNull(),
        version: integer('version').notNull(),
        userId: text('user_id'),
        calendarId: text('calendar_id'),
        eventId: text('event_id'),
        affectedUserId: text('affected_user_id'),
        createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    },
    (t) => [
        index('sync_change_user_idx').on(t.userId, t.sequence),
        index('sync_change_calendar_idx').on(t.calendarId, t.sequence),
        index('sync_change_event_idx').on(t.eventId, t.sequence),
        index('sync_change_affected_user_idx').on(t.affectedUserId, t.sequence),
        check('sync_change_operation_check', sql`${t.operation} IN ('upsert','delete')`),
        check(
            'sync_change_scope_check',
            sql`(${t.userId} IS NOT NULL AND ${t.calendarId} IS NULL AND ${t.eventId} IS NULL) OR (${t.userId} IS NULL AND num_nonnulls(${t.calendarId}, ${t.eventId}) > 0)`,
        ),
    ],
)

export const syncCursor = pgTable(
    'sync_cursor',
    {
        deviceId: text('device_id').primaryKey(),
        userId: userRef(),
        lastSequence: bigint('last_sequence', { mode: 'bigint' })
            .notNull()
            .default(sql`0`),
        lastDeliveredSequence: bigint('last_delivered_sequence', { mode: 'bigint' })
            .notNull()
            .default(sql`0`),
        lastSyncedAt: timestamp('last_synced_at', { withTimezone: true }).notNull().defaultNow(),
        requiresFullSync: boolean('requires_full_sync').notNull().default(true),
    },
    (t) => [
        foreignKey({ columns: [t.deviceId, t.userId], foreignColumns: [userDevice.id, userDevice.userId] }).onDelete(
            'cascade',
        ),
        check('sync_cursor_sequence_check', sql`${t.lastSequence} >= 0`),
    ],
)

export const syncMutation = pgTable(
    'sync_mutation',
    {
        id: text('id')
            .primaryKey()
            .default(sql`gen_random_uuid()::text`),
        userId: userRef(),
        deviceId: text('device_id').notNull(),
        clientMutationId: text('client_mutation_id').notNull(),
        requestHash: text('request_hash').notNull(),
        result: jsonb('result').$type<Record<string, unknown>>().notNull(),
        createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    },
    (t) => [
        foreignKey({ columns: [t.deviceId, t.userId], foreignColumns: [userDevice.id, userDevice.userId] }).onDelete(
            'cascade',
        ),
        unique('sync_mutation_client_request').on(t.userId, t.deviceId, t.clientMutationId),
    ],
)

export const legacyImportMapping = pgTable(
    'legacy_import_mapping',
    {
        id: text('id')
            .primaryKey()
            .default(sql`gen_random_uuid()::text`),
        userId: userRef(),
        deviceId: text('device_id').notNull(),
        entityType: text('entity_type').notNull(),
        localId: text('local_id').notNull(),
        serverId: text('server_id').notNull(),
        importedAt: timestamp('imported_at', { withTimezone: true }).notNull().defaultNow(),
    },
    (t) => [
        foreignKey({ columns: [t.deviceId, t.userId], foreignColumns: [userDevice.id, userDevice.userId] }).onDelete(
            'cascade',
        ),
        unique('legacy_import_mapping_local_key').on(t.userId, t.deviceId, t.entityType, t.localId),
    ],
)

// Frozen, private synchronization pages expire after a short server-defined TTL.
export const syncSnapshot = pgTable(
    'sync_snapshot',
    {
        id: text('id').primaryKey(),
        userId: userRef(),
        deviceId: text('device_id').notNull(),
        highSequence: bigint('high_sequence', { mode: 'bigint' }).notNull(),
        totalItems: integer('total_items').notNull(),
        servedThrough: integer('served_through').notNull().default(0),
        items: jsonb('items').$type<Record<string, unknown>[]>().notNull(),
        expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
        createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    },
    (t) => [
        foreignKey({ columns: [t.deviceId, t.userId], foreignColumns: [userDevice.id, userDevice.userId] }).onDelete(
            'cascade',
        ),
        index('sync_snapshot_expiry_idx').on(t.expiresAt),
    ],
)

export const twoFactor = pgTable(
    'two_factor',
    {
        id: text('id').primaryKey(),
        userId: text('user_id')
            .notNull()
            .references(() => user.id, { onDelete: 'cascade' }),
        secret: text('secret').notNull(),
        backupCodes: text('backup_codes').notNull(),
        verified: boolean('verified').default(true),
        failedVerificationCount: integer('failed_verification_count').default(0),
        lockedUntil: timestamp('locked_until', { withTimezone: true }),
    },
    (t) => [index('two_factor_user_idx').on(t.userId), index('two_factor_secret_idx').on(t.secret)],
)

/** Read-only subscription links are independent of account membership and individually revocable. */
export const calendarShare = pgTable(
    'calendar_share',
    {
        id: text('id').primaryKey(),
        ownerUserId: userRef('owner_user_id'),
        calendarId: calendarRef(),
        selection: jsonb('selection').$type<{ sourceIds: string[]; includeManual: boolean; categories: string[] }>(),
        createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
        revokedAt: timestamp('revoked_at', { withTimezone: true }),
    },
    (t) => [index('calendar_share_owner_idx').on(t.ownerUserId), index('calendar_share_calendar_idx').on(t.calendarId)],
)

// Raw import content is private domain data, persisted in PostgreSQL rather than device files.
export const calendarSourceContent = pgTable('calendar_source_content', {
    sourceId: text('source_id')
        .primaryKey()
        .references(() => calendarSource.id, { onDelete: 'cascade' }),
    content: text('content').notNull(),
    contentHash: text('content_hash').notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
})
