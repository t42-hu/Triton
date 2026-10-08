CREATE TABLE "calendar" (
	"id" text PRIMARY KEY DEFAULT gen_random_uuid()::text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"deleted_at" timestamp with time zone,
	"owner_user_id" text NOT NULL,
	"name" text NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"timezone" text DEFAULT 'Europe/Budapest' NOT NULL,
	"color" text,
	CONSTRAINT "calendar_color_check" CHECK ("calendar"."color" ~ '^#[0-9A-Fa-f]{6}$'),
	CONSTRAINT "calendar_name_check" CHECK (length(trim("calendar"."name")) > 0)
);
--> statement-breakpoint
CREATE TABLE "calendar_event" (
	"id" text PRIMARY KEY DEFAULT gen_random_uuid()::text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"deleted_at" timestamp with time zone,
	"calendar_id" text NOT NULL,
	"source_id" text,
	"external_uid" text,
	"title" text NOT NULL,
	"notes" text DEFAULT '' NOT NULL,
	"location" text DEFAULT '' NOT NULL,
	"color" text,
	"category" text DEFAULT 'event' NOT NULL,
	"kind" text DEFAULT 'timed' NOT NULL,
	"starts_at" timestamp with time zone,
	"ends_at" timestamp with time zone,
	"start_date" date,
	"end_date" date,
	"timezone" text DEFAULT 'Europe/Budapest' NOT NULL,
	"blocks_time" boolean DEFAULT true NOT NULL,
	"created_by_user_id" text,
	CONSTRAINT "calendar_event_title_check" CHECK (length(trim("calendar_event"."title")) > 0),
	CONSTRAINT "calendar_event_color_check" CHECK ("calendar_event"."color" ~ '^#[0-9A-Fa-f]{6}$'),
	CONSTRAINT "calendar_event_category_check" CHECK ("calendar_event"."category" IN ('lesson','event','assignment','test','exam')),
	CONSTRAINT "calendar_event_time_check" CHECK (("calendar_event"."kind" = 'timed' AND "calendar_event"."starts_at" IS NOT NULL AND "calendar_event"."ends_at" IS NOT NULL AND "calendar_event"."ends_at" > "calendar_event"."starts_at" AND "calendar_event"."start_date" IS NULL AND "calendar_event"."end_date" IS NULL) OR ("calendar_event"."kind" = 'allDay' AND "calendar_event"."start_date" IS NOT NULL AND "calendar_event"."end_date" IS NOT NULL AND "calendar_event"."end_date" > "calendar_event"."start_date" AND "calendar_event"."starts_at" IS NULL AND "calendar_event"."ends_at" IS NULL))
);
--> statement-breakpoint
CREATE TABLE "calendar_invitation" (
	"id" text PRIMARY KEY DEFAULT gen_random_uuid()::text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"deleted_at" timestamp with time zone,
	"calendar_id" text NOT NULL,
	"invited_by_user_id" text NOT NULL,
	"invited_user_id" text,
	"invited_email" text,
	"token_hash" text NOT NULL,
	"role" text DEFAULT 'reader' NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"responded_at" timestamp with time zone,
	CONSTRAINT "calendar_invitation_token_hash_unique" UNIQUE("token_hash"),
	CONSTRAINT "calendar_invitation_recipient_check" CHECK ("calendar_invitation"."invited_user_id" IS NOT NULL OR ("calendar_invitation"."invited_email" IS NOT NULL AND length(trim("calendar_invitation"."invited_email")) > 0)),
	CONSTRAINT "calendar_invitation_role_check" CHECK ("calendar_invitation"."role" IN ('reader','editor','busy_only')),
	CONSTRAINT "calendar_invitation_status_check" CHECK ("calendar_invitation"."status" IN ('pending','accepted','declined','revoked','expired'))
);
--> statement-breakpoint
CREATE TABLE "calendar_member" (
	"id" text PRIMARY KEY DEFAULT gen_random_uuid()::text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"deleted_at" timestamp with time zone,
	"calendar_id" text NOT NULL,
	"user_id" text NOT NULL,
	"role" text DEFAULT 'reader' NOT NULL,
	CONSTRAINT "calendar_member_pair" UNIQUE("calendar_id","user_id"),
	CONSTRAINT "calendar_member_role_check" CHECK ("calendar_member"."role" IN ('reader','editor','busy_only'))
);
--> statement-breakpoint
CREATE TABLE "calendar_source" (
	"id" text PRIMARY KEY DEFAULT gen_random_uuid()::text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"deleted_at" timestamp with time zone,
	"calendar_id" text NOT NULL,
	"name" text NOT NULL,
	"format" text NOT NULL,
	"coverage_from" date,
	"coverage_to" date,
	CONSTRAINT "calendar_source_calendar_pair" UNIQUE("id","calendar_id"),
	CONSTRAINT "calendar_source_format_check" CHECK ("calendar_source"."format" IN ('ics','json','manual')),
	CONSTRAINT "calendar_source_coverage_check" CHECK (("calendar_source"."coverage_from" IS NULL AND "calendar_source"."coverage_to" IS NULL) OR ("calendar_source"."coverage_from" IS NOT NULL AND "calendar_source"."coverage_to" IS NOT NULL AND "calendar_source"."coverage_to" >= "calendar_source"."coverage_from"))
);
--> statement-breakpoint
CREATE TABLE "calendar_source_connection" (
	"id" text PRIMARY KEY DEFAULT gen_random_uuid()::text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"deleted_at" timestamp with time zone,
	"source_id" text NOT NULL,
	"url" text,
	"auto_sync" boolean DEFAULT false NOT NULL,
	"etag" text,
	"last_modified" text,
	"imported_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_attempt_at" timestamp with time zone,
	"last_success_at" timestamp with time zone,
	"last_error" text,
	"last_change" text,
	CONSTRAINT "calendar_source_connection_source_id_unique" UNIQUE("source_id"),
	CONSTRAINT "calendar_source_connection_auto_check" CHECK (NOT "calendar_source_connection"."auto_sync" OR "calendar_source_connection"."url" IS NOT NULL)
);
--> statement-breakpoint
CREATE TABLE "calendar_source_revision" (
	"id" text PRIMARY KEY DEFAULT gen_random_uuid()::text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"deleted_at" timestamp with time zone,
	"source_id" text NOT NULL,
	"content_hash" text NOT NULL,
	"storage_key" text NOT NULL,
	"is_current" boolean DEFAULT false NOT NULL,
	CONSTRAINT "calendar_source_revision_source_pair" UNIQUE("source_id","id")
);
--> statement-breakpoint
CREATE TABLE "event_attachment" (
	"id" text PRIMARY KEY DEFAULT gen_random_uuid()::text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"deleted_at" timestamp with time zone,
	"event_id" text NOT NULL,
	"occurrence_key" text DEFAULT '' NOT NULL,
	"uploaded_by_user_id" text,
	"kind" text NOT NULL,
	"name" text NOT NULL,
	"storage_key" text,
	"url" text,
	"mime_type" text,
	"size_bytes" bigint,
	"content_hash" text,
	CONSTRAINT "event_attachment_payload_check" CHECK (("event_attachment"."kind" = 'file' AND "event_attachment"."storage_key" IS NOT NULL AND "event_attachment"."url" IS NULL AND "event_attachment"."mime_type" IS NOT NULL AND "event_attachment"."size_bytes" IS NOT NULL AND "event_attachment"."size_bytes" >= 0) OR ("event_attachment"."kind" = 'link' AND "event_attachment"."url" IS NOT NULL AND "event_attachment"."url" ~* '^https?://' AND "event_attachment"."storage_key" IS NULL AND "event_attachment"."size_bytes" IS NULL))
);
--> statement-breakpoint
CREATE TABLE "event_exception" (
	"id" text PRIMARY KEY DEFAULT gen_random_uuid()::text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"deleted_at" timestamp with time zone,
	"event_id" text NOT NULL,
	"occurrence_key" text NOT NULL,
	"canceled" boolean DEFAULT false NOT NULL,
	"title" text,
	"notes" text,
	"location" text,
	"color" text,
	"starts_at" timestamp with time zone,
	"ends_at" timestamp with time zone,
	"start_date" date,
	"end_date" date,
	CONSTRAINT "event_exception_occurrence_pair" UNIQUE("event_id","occurrence_key"),
	CONSTRAINT "event_exception_color_check" CHECK ("event_exception"."color" ~ '^#[0-9A-Fa-f]{6}$'),
	CONSTRAINT "event_exception_time_check" CHECK ((("event_exception"."starts_at" IS NULL AND "event_exception"."ends_at" IS NULL) OR ("event_exception"."starts_at" IS NOT NULL AND "event_exception"."ends_at" IS NOT NULL AND "event_exception"."ends_at" > "event_exception"."starts_at")) AND (("event_exception"."start_date" IS NULL AND "event_exception"."end_date" IS NULL) OR ("event_exception"."start_date" IS NOT NULL AND "event_exception"."end_date" IS NOT NULL AND "event_exception"."end_date" > "event_exception"."start_date")) AND NOT ("event_exception"."starts_at" IS NOT NULL AND "event_exception"."start_date" IS NOT NULL))
);
--> statement-breakpoint
CREATE TABLE "event_recurrence" (
	"id" text PRIMARY KEY DEFAULT gen_random_uuid()::text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"deleted_at" timestamp with time zone,
	"event_id" text NOT NULL,
	"rule" text NOT NULL,
	"timezone" text DEFAULT 'Europe/Budapest' NOT NULL,
	"until_at" timestamp with time zone,
	"anchor_date" date,
	"anchor_week" text,
	"week_pattern" text DEFAULT 'all' NOT NULL,
	CONSTRAINT "event_recurrence_event_id_unique" UNIQUE("event_id"),
	CONSTRAINT "event_recurrence_week_check" CHECK ("event_recurrence"."week_pattern" IN ('all','A','B') AND ("event_recurrence"."anchor_week" IS NULL OR "event_recurrence"."anchor_week" IN ('A','B')) AND ("event_recurrence"."week_pattern" = 'all' OR ("event_recurrence"."anchor_date" IS NOT NULL AND "event_recurrence"."anchor_week" IS NOT NULL)))
);
--> statement-breakpoint
CREATE TABLE "legacy_import_mapping" (
	"id" text PRIMARY KEY DEFAULT gen_random_uuid()::text NOT NULL,
	"user_id" text NOT NULL,
	"device_id" text NOT NULL,
	"entity_type" text NOT NULL,
	"local_id" text NOT NULL,
	"server_id" text NOT NULL,
	"imported_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "legacy_import_mapping_local_key" UNIQUE("user_id","device_id","entity_type","local_id")
);
--> statement-breakpoint
CREATE TABLE "meeting" (
	"id" text PRIMARY KEY DEFAULT gen_random_uuid()::text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"deleted_at" timestamp with time zone,
	"event_id" text NOT NULL,
	"organizer_user_id" text NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	CONSTRAINT "meeting_event_id_unique" UNIQUE("event_id"),
	CONSTRAINT "meeting_status_check" CHECK ("meeting"."status" IN ('draft','published','canceled'))
);
--> statement-breakpoint
CREATE TABLE "meeting_participant" (
	"id" text PRIMARY KEY DEFAULT gen_random_uuid()::text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"deleted_at" timestamp with time zone,
	"meeting_id" text NOT NULL,
	"user_id" text NOT NULL,
	"invited_by_user_id" text,
	"response" text DEFAULT 'pending' NOT NULL,
	"responded_at" timestamp with time zone,
	CONSTRAINT "meeting_participant_pair" UNIQUE("meeting_id","user_id"),
	CONSTRAINT "meeting_participant_response_check" CHECK ("meeting_participant"."response" IN ('pending','accepted','declined','tentative'))
);
--> statement-breakpoint
CREATE TABLE "schedule_profile" (
	"id" text PRIMARY KEY DEFAULT gen_random_uuid()::text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"deleted_at" timestamp with time zone,
	"user_id" text NOT NULL,
	"name" text NOT NULL,
	"is_own" boolean DEFAULT false NOT NULL,
	"linked_user_id" text,
	CONSTRAINT "schedule_profile_owner_pair" UNIQUE("id","user_id")
);
--> statement-breakpoint
CREATE TABLE "schedule_profile_calendar" (
	"id" text PRIMARY KEY DEFAULT gen_random_uuid()::text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"deleted_at" timestamp with time zone,
	"user_id" text NOT NULL,
	"profile_id" text NOT NULL,
	"calendar_id" text NOT NULL,
	"position" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "schedule_profile_calendar_pair" UNIQUE("profile_id","calendar_id")
);
--> statement-breakpoint
CREATE TABLE "sync_change" (
	"sequence" bigserial PRIMARY KEY NOT NULL,
	"entity_type" text NOT NULL,
	"entity_id" text NOT NULL,
	"operation" text NOT NULL,
	"version" integer NOT NULL,
	"user_id" text,
	"calendar_id" text,
	"event_id" text,
	"affected_user_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "sync_change_operation_check" CHECK ("sync_change"."operation" IN ('upsert','delete')),
	CONSTRAINT "sync_change_scope_check" CHECK (("sync_change"."user_id" IS NOT NULL AND "sync_change"."calendar_id" IS NULL AND "sync_change"."event_id" IS NULL) OR ("sync_change"."user_id" IS NULL AND num_nonnulls("sync_change"."calendar_id", "sync_change"."event_id") > 0))
);
--> statement-breakpoint
CREATE TABLE "sync_cursor" (
	"device_id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"last_sequence" bigint DEFAULT 0 NOT NULL,
	"last_synced_at" timestamp with time zone DEFAULT now() NOT NULL,
	"requires_full_sync" boolean DEFAULT true NOT NULL,
	CONSTRAINT "sync_cursor_sequence_check" CHECK ("sync_cursor"."last_sequence" >= 0)
);
--> statement-breakpoint
CREATE TABLE "sync_mutation" (
	"id" text PRIMARY KEY DEFAULT gen_random_uuid()::text NOT NULL,
	"user_id" text NOT NULL,
	"device_id" text NOT NULL,
	"client_mutation_id" text NOT NULL,
	"request_hash" text NOT NULL,
	"result" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "sync_mutation_client_request" UNIQUE("user_id","device_id","client_mutation_id")
);
--> statement-breakpoint
CREATE TABLE "user_calendar_preference" (
	"id" text PRIMARY KEY DEFAULT gen_random_uuid()::text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"deleted_at" timestamp with time zone,
	"user_id" text NOT NULL,
	"calendar_id" text NOT NULL,
	"visible" boolean DEFAULT true NOT NULL,
	"position" integer DEFAULT 0 NOT NULL,
	"color" text,
	CONSTRAINT "user_calendar_preference_pair" UNIQUE("user_id","calendar_id"),
	CONSTRAINT "user_calendar_preference_color_check" CHECK ("user_calendar_preference"."color" ~ '^#[0-9A-Fa-f]{6}$')
);
--> statement-breakpoint
CREATE TABLE "user_color_preset" (
	"id" text PRIMARY KEY DEFAULT gen_random_uuid()::text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"deleted_at" timestamp with time zone,
	"user_id" text NOT NULL,
	"name" text NOT NULL,
	CONSTRAINT "user_color_preset_owner_pair" UNIQUE("id","user_id")
);
--> statement-breakpoint
CREATE TABLE "user_color_preset_color" (
	"id" text PRIMARY KEY DEFAULT gen_random_uuid()::text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"deleted_at" timestamp with time zone,
	"user_id" text NOT NULL,
	"preset_id" text NOT NULL,
	"role" text NOT NULL,
	"position" integer DEFAULT 0 NOT NULL,
	"color" text NOT NULL,
	"light_color" text,
	"dark_color" text,
	CONSTRAINT "user_color_preset_color_role" UNIQUE("preset_id","role"),
	CONSTRAINT "user_color_preset_color_check" CHECK ("user_color_preset_color"."color" ~ '^#[0-9A-Fa-f]{6}$' AND ("user_color_preset_color"."light_color" IS NULL OR "user_color_preset_color"."light_color" ~ '^#[0-9A-Fa-f]{6}$') AND ("user_color_preset_color"."dark_color" IS NULL OR "user_color_preset_color"."dark_color" ~ '^#[0-9A-Fa-f]{6}$'))
);
--> statement-breakpoint
CREATE TABLE "user_color_rule" (
	"id" text PRIMARY KEY DEFAULT gen_random_uuid()::text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"deleted_at" timestamp with time zone,
	"user_id" text NOT NULL,
	"scope" text NOT NULL,
	"target_key" text NOT NULL,
	"calendar_id" text,
	"event_id" text,
	"occurrence_key" text,
	"preset_id" text,
	"color" text,
	"light_color" text,
	"dark_color" text,
	"green_color" text,
	"yellow_color" text,
	"red_color" text,
	"green_minutes" integer,
	"yellow_minutes" integer,
	"red_minutes" integer,
	CONSTRAINT "user_color_rule_target" UNIQUE("user_id","scope","target_key"),
	CONSTRAINT "user_color_rule_scope_check" CHECK (("user_color_rule"."scope" = 'default' AND "user_color_rule"."calendar_id" IS NULL AND "user_color_rule"."event_id" IS NULL AND "user_color_rule"."occurrence_key" IS NULL) OR ("user_color_rule"."scope" IN ('calendar','series') AND "user_color_rule"."calendar_id" IS NOT NULL AND "user_color_rule"."event_id" IS NULL AND "user_color_rule"."occurrence_key" IS NULL) OR ("user_color_rule"."scope" = 'event' AND "user_color_rule"."event_id" IS NOT NULL AND "user_color_rule"."calendar_id" IS NULL AND "user_color_rule"."occurrence_key" IS NULL) OR ("user_color_rule"."scope" = 'occurrence' AND "user_color_rule"."event_id" IS NOT NULL AND "user_color_rule"."calendar_id" IS NULL AND "user_color_rule"."occurrence_key" IS NOT NULL AND length("user_color_rule"."occurrence_key") > 0)),
	CONSTRAINT "user_color_rule_colors_check" CHECK (("user_color_rule"."color" IS NULL OR "user_color_rule"."color" ~ '^#[0-9A-Fa-f]{6}$') AND ("user_color_rule"."light_color" IS NULL OR "user_color_rule"."light_color" ~ '^#[0-9A-Fa-f]{6}$') AND ("user_color_rule"."dark_color" IS NULL OR "user_color_rule"."dark_color" ~ '^#[0-9A-Fa-f]{6}$')),
	CONSTRAINT "user_color_rule_urgency_check" CHECK (("user_color_rule"."green_color" IS NULL AND "user_color_rule"."yellow_color" IS NULL AND "user_color_rule"."red_color" IS NULL AND "user_color_rule"."green_minutes" IS NULL AND "user_color_rule"."yellow_minutes" IS NULL AND "user_color_rule"."red_minutes" IS NULL) OR ("user_color_rule"."green_color" IS NOT NULL AND "user_color_rule"."yellow_color" IS NOT NULL AND "user_color_rule"."red_color" IS NOT NULL AND "user_color_rule"."green_color" ~ '^#[0-9A-Fa-f]{6}$' AND "user_color_rule"."yellow_color" ~ '^#[0-9A-Fa-f]{6}$' AND "user_color_rule"."red_color" ~ '^#[0-9A-Fa-f]{6}$' AND "user_color_rule"."yellow_minutes" IS NOT NULL AND "user_color_rule"."red_minutes" IS NOT NULL AND "user_color_rule"."red_minutes" >= 0 AND "user_color_rule"."yellow_minutes" > "user_color_rule"."red_minutes" AND ("user_color_rule"."green_minutes" IS NULL OR "user_color_rule"."green_minutes" > "user_color_rule"."yellow_minutes")))
);
--> statement-breakpoint
CREATE TABLE "user_device" (
	"id" text PRIMARY KEY DEFAULT gen_random_uuid()::text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"deleted_at" timestamp with time zone,
	"user_id" text NOT NULL,
	"installation_id" text NOT NULL,
	"platform" text NOT NULL,
	"name" text,
	"push_token" text,
	"last_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	"revoked_at" timestamp with time zone,
	CONSTRAINT "user_device_installation_pair" UNIQUE("user_id","installation_id"),
	CONSTRAINT "user_device_owner_pair" UNIQUE("id","user_id"),
	CONSTRAINT "user_device_platform_check" CHECK ("user_device"."platform" IN ('web','android','ios','desktop'))
);
--> statement-breakpoint
CREATE TABLE "user_device_preference" (
	"id" text PRIMARY KEY DEFAULT gen_random_uuid()::text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"deleted_at" timestamp with time zone,
	"user_id" text NOT NULL,
	"device_id" text NOT NULL,
	"arrangement" text DEFAULT 'column' NOT NULL,
	"zoom_percent" integer DEFAULT 100 NOT NULL,
	"notifications_enabled" boolean DEFAULT true NOT NULL,
	"first_import_at" timestamp with time zone,
	"battery_prompt_shown_at" timestamp with time zone,
	"quick_actions" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"view_state" jsonb DEFAULT '{}'::jsonb NOT NULL,
	CONSTRAINT "user_device_preference_device_id_unique" UNIQUE("device_id"),
	CONSTRAINT "user_device_preference_arrangement_check" CHECK ("user_device_preference"."arrangement" IN ('row','column')),
	CONSTRAINT "user_device_preference_zoom_check" CHECK ("user_device_preference"."zoom_percent" BETWEEN 25 AND 400),
	CONSTRAINT "user_device_preference_json_check" CHECK (jsonb_typeof("user_device_preference"."quick_actions") = 'array' AND jsonb_typeof("user_device_preference"."view_state") = 'object')
);
--> statement-breakpoint
CREATE TABLE "user_event_override" (
	"id" text PRIMARY KEY DEFAULT gen_random_uuid()::text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"deleted_at" timestamp with time zone,
	"user_id" text NOT NULL,
	"event_id" text NOT NULL,
	"occurrence_key" text DEFAULT '' NOT NULL,
	"title" text,
	"notes" text,
	"location" text,
	"hidden" boolean DEFAULT false NOT NULL,
	"starts_at" timestamp with time zone,
	"ends_at" timestamp with time zone,
	"start_date" date,
	"end_date" date,
	CONSTRAINT "user_event_override_target" UNIQUE("user_id","event_id","occurrence_key"),
	CONSTRAINT "user_event_override_time_check" CHECK ((("user_event_override"."starts_at" IS NULL AND "user_event_override"."ends_at" IS NULL) OR ("user_event_override"."starts_at" IS NOT NULL AND "user_event_override"."ends_at" IS NOT NULL AND "user_event_override"."ends_at" > "user_event_override"."starts_at")) AND (("user_event_override"."start_date" IS NULL AND "user_event_override"."end_date" IS NULL) OR ("user_event_override"."start_date" IS NOT NULL AND "user_event_override"."end_date" IS NOT NULL AND "user_event_override"."end_date" > "user_event_override"."start_date")) AND NOT ("user_event_override"."starts_at" IS NOT NULL AND "user_event_override"."start_date" IS NOT NULL))
);
--> statement-breakpoint
CREATE TABLE "user_event_reminder_setting" (
	"id" text PRIMARY KEY DEFAULT gen_random_uuid()::text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"deleted_at" timestamp with time zone,
	"user_id" text NOT NULL,
	"event_id" text NOT NULL,
	"occurrence_key" text DEFAULT '' NOT NULL,
	"exclude_global" boolean DEFAULT false NOT NULL,
	CONSTRAINT "user_event_reminder_setting_target" UNIQUE("user_id","event_id","occurrence_key")
);
--> statement-breakpoint
CREATE TABLE "user_notebook_link" (
	"id" text PRIMARY KEY DEFAULT gen_random_uuid()::text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"deleted_at" timestamp with time zone,
	"user_id" text NOT NULL,
	"profile_id" text,
	"subject_key" text,
	"subject" text,
	"event_id" text,
	"occurrence_key" text,
	"title" text NOT NULL,
	"url" text NOT NULL,
	CONSTRAINT "user_notebook_link_url_check" CHECK ("user_notebook_link"."url" ~* '^https?://')
);
--> statement-breakpoint
CREATE TABLE "user_preference" (
	"id" text PRIMARY KEY DEFAULT gen_random_uuid()::text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"deleted_at" timestamp with time zone,
	"user_id" text NOT NULL,
	"theme" text DEFAULT 'system' NOT NULL,
	"timezone" text DEFAULT 'Europe/Budapest' NOT NULL,
	"startup_view" text DEFAULT 'today' NOT NULL,
	"calendar_view" text DEFAULT 'week' NOT NULL,
	"show_weekends" boolean DEFAULT true NOT NULL,
	"start_hour" integer DEFAULT 7 NOT NULL,
	"end_hour" integer DEFAULT 20 NOT NULL,
	"change_notifications" boolean DEFAULT false NOT NULL,
	"minimum_free_minutes" integer DEFAULT 30 NOT NULL,
	"bound_free_time_to_events" boolean DEFAULT true NOT NULL,
	"anchor_date" date,
	"anchor_week" text,
	CONSTRAINT "user_preference_user_id_unique" UNIQUE("user_id"),
	CONSTRAINT "user_preference_theme_check" CHECK ("user_preference"."theme" IN ('system','light','dark')),
	CONSTRAINT "user_preference_view_check" CHECK ("user_preference"."startup_view" IN ('today','last') AND "user_preference"."calendar_view" IN ('day','week')),
	CONSTRAINT "user_preference_hours_check" CHECK ("user_preference"."start_hour" >= 0 AND "user_preference"."end_hour" <= 24 AND "user_preference"."end_hour" > "user_preference"."start_hour"),
	CONSTRAINT "user_preference_free_minutes_check" CHECK ("user_preference"."minimum_free_minutes" > 0),
	CONSTRAINT "user_preference_anchor_check" CHECK (("user_preference"."anchor_date" IS NULL AND "user_preference"."anchor_week" IS NULL) OR ("user_preference"."anchor_date" IS NOT NULL AND "user_preference"."anchor_week" IS NOT NULL AND "user_preference"."anchor_week" IN ('A','B')))
);
--> statement-breakpoint
CREATE TABLE "user_reminder_rule" (
	"id" text PRIMARY KEY DEFAULT gen_random_uuid()::text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"deleted_at" timestamp with time zone,
	"user_id" text NOT NULL,
	"event_id" text,
	"occurrence_key" text DEFAULT '' NOT NULL,
	"minutes" integer NOT NULL,
	"profile" text DEFAULT 'standard' NOT NULL,
	CONSTRAINT "user_reminder_rule_minutes_check" CHECK ("user_reminder_rule"."minutes" BETWEEN 1 AND 10080),
	CONSTRAINT "user_reminder_rule_profile_check" CHECK ("user_reminder_rule"."profile" IN ('gentle','standard','strong')),
	CONSTRAINT "user_reminder_rule_target_check" CHECK ("user_reminder_rule"."event_id" IS NOT NULL OR "user_reminder_rule"."occurrence_key" = '')
);
--> statement-breakpoint
CREATE TABLE "user_reminder_setting" (
	"id" text PRIMARY KEY DEFAULT gen_random_uuid()::text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"deleted_at" timestamp with time zone,
	"user_id" text NOT NULL,
	"enabled" boolean DEFAULT false NOT NULL,
	CONSTRAINT "user_reminder_setting_user_id_unique" UNIQUE("user_id")
);
--> statement-breakpoint
CREATE TABLE "user_task" (
	"id" text PRIMARY KEY DEFAULT gen_random_uuid()::text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"deleted_at" timestamp with time zone,
	"user_id" text NOT NULL,
	"profile_id" text,
	"title" text NOT NULL,
	"notes" text DEFAULT '' NOT NULL,
	"event_id" text,
	"occurrence_key" text,
	"completed" boolean DEFAULT false NOT NULL,
	"due_at" timestamp with time zone,
	"event_title" text,
	CONSTRAINT "user_task_title_check" CHECK (length(trim("user_task"."title")) > 0)
);
--> statement-breakpoint
ALTER TABLE "calendar" ADD CONSTRAINT "calendar_owner_user_id_user_id_fk" FOREIGN KEY ("owner_user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "calendar_event" ADD CONSTRAINT "calendar_event_calendar_id_calendar_id_fk" FOREIGN KEY ("calendar_id") REFERENCES "public"."calendar"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "calendar_event" ADD CONSTRAINT "calendar_event_created_by_user_id_user_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "calendar_event" ADD CONSTRAINT "calendar_event_source_id_calendar_id_calendar_source_id_calendar_id_fk" FOREIGN KEY ("source_id","calendar_id") REFERENCES "public"."calendar_source"("id","calendar_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "calendar_invitation" ADD CONSTRAINT "calendar_invitation_calendar_id_calendar_id_fk" FOREIGN KEY ("calendar_id") REFERENCES "public"."calendar"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "calendar_invitation" ADD CONSTRAINT "calendar_invitation_invited_by_user_id_user_id_fk" FOREIGN KEY ("invited_by_user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "calendar_invitation" ADD CONSTRAINT "calendar_invitation_invited_user_id_user_id_fk" FOREIGN KEY ("invited_user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "calendar_member" ADD CONSTRAINT "calendar_member_calendar_id_calendar_id_fk" FOREIGN KEY ("calendar_id") REFERENCES "public"."calendar"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "calendar_member" ADD CONSTRAINT "calendar_member_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "calendar_source" ADD CONSTRAINT "calendar_source_calendar_id_calendar_id_fk" FOREIGN KEY ("calendar_id") REFERENCES "public"."calendar"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "calendar_source_connection" ADD CONSTRAINT "calendar_source_connection_source_id_calendar_source_id_fk" FOREIGN KEY ("source_id") REFERENCES "public"."calendar_source"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "calendar_source_revision" ADD CONSTRAINT "calendar_source_revision_source_id_calendar_source_id_fk" FOREIGN KEY ("source_id") REFERENCES "public"."calendar_source"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "event_attachment" ADD CONSTRAINT "event_attachment_event_id_calendar_event_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."calendar_event"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "event_attachment" ADD CONSTRAINT "event_attachment_uploaded_by_user_id_user_id_fk" FOREIGN KEY ("uploaded_by_user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "event_exception" ADD CONSTRAINT "event_exception_event_id_calendar_event_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."calendar_event"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "event_recurrence" ADD CONSTRAINT "event_recurrence_event_id_calendar_event_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."calendar_event"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "legacy_import_mapping" ADD CONSTRAINT "legacy_import_mapping_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "legacy_import_mapping" ADD CONSTRAINT "legacy_import_mapping_device_id_user_id_user_device_id_user_id_fk" FOREIGN KEY ("device_id","user_id") REFERENCES "public"."user_device"("id","user_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "meeting" ADD CONSTRAINT "meeting_event_id_calendar_event_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."calendar_event"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "meeting" ADD CONSTRAINT "meeting_organizer_user_id_user_id_fk" FOREIGN KEY ("organizer_user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "meeting_participant" ADD CONSTRAINT "meeting_participant_meeting_id_meeting_id_fk" FOREIGN KEY ("meeting_id") REFERENCES "public"."meeting"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "meeting_participant" ADD CONSTRAINT "meeting_participant_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "meeting_participant" ADD CONSTRAINT "meeting_participant_invited_by_user_id_user_id_fk" FOREIGN KEY ("invited_by_user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "schedule_profile" ADD CONSTRAINT "schedule_profile_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "schedule_profile" ADD CONSTRAINT "schedule_profile_linked_user_id_user_id_fk" FOREIGN KEY ("linked_user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "schedule_profile_calendar" ADD CONSTRAINT "schedule_profile_calendar_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "schedule_profile_calendar" ADD CONSTRAINT "schedule_profile_calendar_calendar_id_calendar_id_fk" FOREIGN KEY ("calendar_id") REFERENCES "public"."calendar"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "schedule_profile_calendar" ADD CONSTRAINT "schedule_profile_calendar_profile_id_user_id_schedule_profile_id_user_id_fk" FOREIGN KEY ("profile_id","user_id") REFERENCES "public"."schedule_profile"("id","user_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sync_cursor" ADD CONSTRAINT "sync_cursor_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sync_cursor" ADD CONSTRAINT "sync_cursor_device_id_user_id_user_device_id_user_id_fk" FOREIGN KEY ("device_id","user_id") REFERENCES "public"."user_device"("id","user_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sync_mutation" ADD CONSTRAINT "sync_mutation_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sync_mutation" ADD CONSTRAINT "sync_mutation_device_id_user_id_user_device_id_user_id_fk" FOREIGN KEY ("device_id","user_id") REFERENCES "public"."user_device"("id","user_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_calendar_preference" ADD CONSTRAINT "user_calendar_preference_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_calendar_preference" ADD CONSTRAINT "user_calendar_preference_calendar_id_calendar_id_fk" FOREIGN KEY ("calendar_id") REFERENCES "public"."calendar"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_color_preset" ADD CONSTRAINT "user_color_preset_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_color_preset_color" ADD CONSTRAINT "user_color_preset_color_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_color_preset_color" ADD CONSTRAINT "user_color_preset_color_preset_id_user_id_user_color_preset_id_user_id_fk" FOREIGN KEY ("preset_id","user_id") REFERENCES "public"."user_color_preset"("id","user_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_color_rule" ADD CONSTRAINT "user_color_rule_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_color_rule" ADD CONSTRAINT "user_color_rule_calendar_id_calendar_id_fk" FOREIGN KEY ("calendar_id") REFERENCES "public"."calendar"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_color_rule" ADD CONSTRAINT "user_color_rule_event_id_calendar_event_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."calendar_event"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_color_rule" ADD CONSTRAINT "user_color_rule_preset_id_user_id_user_color_preset_id_user_id_fk" FOREIGN KEY ("preset_id","user_id") REFERENCES "public"."user_color_preset"("id","user_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_device" ADD CONSTRAINT "user_device_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_device_preference" ADD CONSTRAINT "user_device_preference_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_device_preference" ADD CONSTRAINT "user_device_preference_device_id_user_id_user_device_id_user_id_fk" FOREIGN KEY ("device_id","user_id") REFERENCES "public"."user_device"("id","user_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_event_override" ADD CONSTRAINT "user_event_override_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_event_override" ADD CONSTRAINT "user_event_override_event_id_calendar_event_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."calendar_event"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_event_reminder_setting" ADD CONSTRAINT "user_event_reminder_setting_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_event_reminder_setting" ADD CONSTRAINT "user_event_reminder_setting_event_id_calendar_event_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."calendar_event"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_notebook_link" ADD CONSTRAINT "user_notebook_link_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_notebook_link" ADD CONSTRAINT "user_notebook_link_event_id_calendar_event_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."calendar_event"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_notebook_link" ADD CONSTRAINT "user_notebook_link_profile_id_user_id_schedule_profile_id_user_id_fk" FOREIGN KEY ("profile_id","user_id") REFERENCES "public"."schedule_profile"("id","user_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_preference" ADD CONSTRAINT "user_preference_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_reminder_rule" ADD CONSTRAINT "user_reminder_rule_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_reminder_rule" ADD CONSTRAINT "user_reminder_rule_event_id_calendar_event_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."calendar_event"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_reminder_setting" ADD CONSTRAINT "user_reminder_setting_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_task" ADD CONSTRAINT "user_task_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_task" ADD CONSTRAINT "user_task_event_id_calendar_event_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."calendar_event"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_task" ADD CONSTRAINT "user_task_profile_id_user_id_schedule_profile_id_user_id_fk" FOREIGN KEY ("profile_id","user_id") REFERENCES "public"."schedule_profile"("id","user_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "calendar_owner_idx" ON "calendar" USING btree ("owner_user_id");--> statement-breakpoint
CREATE INDEX "calendar_event_window_idx" ON "calendar_event" USING btree ("calendar_id","starts_at","ends_at");--> statement-breakpoint
CREATE INDEX "calendar_event_dates_idx" ON "calendar_event" USING btree ("calendar_id","start_date","end_date");--> statement-breakpoint
CREATE UNIQUE INDEX "calendar_event_source_uid" ON "calendar_event" USING btree ("source_id","external_uid") WHERE "calendar_event"."external_uid" IS NOT NULL;--> statement-breakpoint
CREATE INDEX "calendar_invitation_calendar_idx" ON "calendar_invitation" USING btree ("calendar_id");--> statement-breakpoint
CREATE INDEX "calendar_invitation_recipient_idx" ON "calendar_invitation" USING btree ("invited_user_id");--> statement-breakpoint
CREATE INDEX "calendar_member_user_idx" ON "calendar_member" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "calendar_source_calendar_idx" ON "calendar_source" USING btree ("calendar_id");--> statement-breakpoint
CREATE INDEX "calendar_source_revision_source_idx" ON "calendar_source_revision" USING btree ("source_id");--> statement-breakpoint
CREATE UNIQUE INDEX "calendar_source_revision_one_current" ON "calendar_source_revision" USING btree ("source_id") WHERE "calendar_source_revision"."is_current" AND "calendar_source_revision"."deleted_at" IS NULL;--> statement-breakpoint
CREATE INDEX "event_attachment_event_idx" ON "event_attachment" USING btree ("event_id");--> statement-breakpoint
CREATE INDEX "meeting_organizer_idx" ON "meeting" USING btree ("organizer_user_id");--> statement-breakpoint
CREATE INDEX "meeting_participant_user_idx" ON "meeting_participant" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "schedule_profile_user_idx" ON "schedule_profile" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "schedule_profile_one_own" ON "schedule_profile" USING btree ("user_id") WHERE "schedule_profile"."is_own" AND "schedule_profile"."deleted_at" IS NULL;--> statement-breakpoint
CREATE INDEX "schedule_profile_calendar_calendar_idx" ON "schedule_profile_calendar" USING btree ("calendar_id");--> statement-breakpoint
CREATE INDEX "sync_change_user_idx" ON "sync_change" USING btree ("user_id","sequence");--> statement-breakpoint
CREATE INDEX "sync_change_calendar_idx" ON "sync_change" USING btree ("calendar_id","sequence");--> statement-breakpoint
CREATE INDEX "sync_change_event_idx" ON "sync_change" USING btree ("event_id","sequence");--> statement-breakpoint
CREATE INDEX "sync_change_affected_user_idx" ON "sync_change" USING btree ("affected_user_id","sequence");--> statement-breakpoint
CREATE INDEX "user_color_preset_user_idx" ON "user_color_preset" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "user_notebook_link_subject_idx" ON "user_notebook_link" USING btree ("user_id","subject_key");--> statement-breakpoint
CREATE UNIQUE INDEX "user_reminder_rule_global" ON "user_reminder_rule" USING btree ("user_id","minutes") WHERE "user_reminder_rule"."event_id" IS NULL AND "user_reminder_rule"."deleted_at" IS NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "user_reminder_rule_event" ON "user_reminder_rule" USING btree ("user_id","event_id","occurrence_key","minutes") WHERE "user_reminder_rule"."event_id" IS NOT NULL AND "user_reminder_rule"."deleted_at" IS NULL;--> statement-breakpoint
CREATE INDEX "user_task_due_idx" ON "user_task" USING btree ("user_id","completed","due_at");--> statement-breakpoint
CREATE INDEX "account_user_idx" ON "account" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "user_email_normalized_unique" ON "user" USING btree (lower(trim("email")));--> statement-breakpoint
ALTER TABLE "account" ADD CONSTRAINT "account_provider_identity" UNIQUE("provider_id","account_id");