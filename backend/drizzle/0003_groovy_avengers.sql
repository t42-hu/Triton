CREATE TABLE "sync_snapshot" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"device_id" text NOT NULL,
	"high_sequence" bigint NOT NULL,
	"total_items" integer NOT NULL,
	"served_through" integer DEFAULT 0 NOT NULL,
	"items" jsonb NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "sync_cursor" ADD COLUMN "last_delivered_sequence" bigint DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "sync_snapshot" ADD CONSTRAINT "sync_snapshot_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sync_snapshot" ADD CONSTRAINT "sync_snapshot_device_id_user_id_user_device_id_user_id_fk" FOREIGN KEY ("device_id","user_id") REFERENCES "public"."user_device"("id","user_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "sync_snapshot_expiry_idx" ON "sync_snapshot" USING btree ("expires_at");