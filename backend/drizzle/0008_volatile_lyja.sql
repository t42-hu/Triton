ALTER TABLE "calendar_event" DROP CONSTRAINT "calendar_event_category_check";--> statement-breakpoint
ALTER TABLE "calendar_event" ADD CONSTRAINT "calendar_event_category_check" CHECK ("calendar_event"."category" IN ('lesson','event','work','assignment','test','exam'));
--> statement-breakpoint
WITH reclassified AS (
    UPDATE "calendar_event"
    SET "category" = 'work', "version" = "version" + 1, "updated_at" = now()
    WHERE "deleted_at" IS NULL AND "source_id" IS NOT NULL
      AND "category" <> 'work' AND "external_uid" LIKE '%@wagetrackr.eu%'
    RETURNING "id", "calendar_id", "version"
)
INSERT INTO "sync_change" ("entity_type", "entity_id", "operation", "version", "calendar_id", "event_id")
SELECT 'calendar_event', "id", 'upsert', "version", "calendar_id", "id" FROM reclassified;
