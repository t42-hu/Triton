CREATE TABLE "calendar_share" (
	"id" text PRIMARY KEY NOT NULL,
	"owner_user_id" text NOT NULL,
	"calendar_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"revoked_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "calendar_share" ADD CONSTRAINT "calendar_share_owner_user_id_user_id_fk" FOREIGN KEY ("owner_user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "calendar_share" ADD CONSTRAINT "calendar_share_calendar_id_calendar_id_fk" FOREIGN KEY ("calendar_id") REFERENCES "public"."calendar"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "calendar_share_owner_idx" ON "calendar_share" USING btree ("owner_user_id");--> statement-breakpoint
CREATE INDEX "calendar_share_calendar_idx" ON "calendar_share" USING btree ("calendar_id");