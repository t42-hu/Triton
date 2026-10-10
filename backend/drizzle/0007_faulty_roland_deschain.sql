ALTER TABLE "calendar_share" ADD COLUMN "selection" jsonb;
--> statement-breakpoint
UPDATE "calendar_share" sh SET "selection"=jsonb_build_object(
    'sourceIds', COALESCE((SELECT jsonb_agg(s.id ORDER BY s.id) FROM calendar_source s
        WHERE s.calendar_id=sh.calendar_id AND s.deleted_at IS NULL AND s.format<>'manual'), '[]'::jsonb),
    'includeManual', true,
    'categories', '["lesson","event","assignment","test","exam"]'::jsonb)
WHERE sh.selection IS NULL;
