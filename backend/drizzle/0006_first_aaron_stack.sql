CREATE TABLE "calendar_source_content" (
	"source_id" text PRIMARY KEY NOT NULL,
	"content" text NOT NULL,
	"content_hash" text NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "calendar_source_content" ADD CONSTRAINT "calendar_source_content_source_id_calendar_source_id_fk" FOREIGN KEY ("source_id") REFERENCES "public"."calendar_source"("id") ON DELETE cascade ON UPDATE no action;