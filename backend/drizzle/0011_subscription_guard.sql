CREATE OR REPLACE FUNCTION public.triton_guard_subscription() RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog,public AS $$
BEGIN
 IF current_setting('triton.subscription_worker',true)='true' THEN RETURN NEW; END IF;
 IF EXISTS(SELECT 1 FROM calendar_subscription_job j JOIN calendar_source_connection c ON c.source_id=j.source_id
   WHERE j.source_id=NEW.source_id AND j.published_at IS NOT NULL AND c.url IS NOT NULL AND c.deleted_at IS NULL) THEN
  IF TG_TABLE_NAME='calendar_source_content' THEN
   IF TG_OP='INSERT' OR NEW.content_hash IS DISTINCT FROM OLD.content_hash THEN
    RAISE EXCEPTION 'Subscription content is managed by the server' USING ERRCODE='23514';
   END IF;
  ELSIF NEW.deleted_at IS NOT NULL AND OLD.deleted_at IS NULL THEN
   IF NOT EXISTS(SELECT 1 FROM calendar_source s JOIN calendar a ON a.id=s.calendar_id
     WHERE s.id=NEW.source_id AND (s.deleted_at IS NOT NULL OR a.deleted_at IS NOT NULL)) THEN
    RAISE EXCEPTION 'Subscription event deletion is managed by the server; use a hidden override' USING ERRCODE='23514';
   END IF;
  ELSIF NEW.deleted_at IS NULL THEN
   IF TG_OP='INSERT' OR (to_jsonb(NEW)-ARRAY['version','created_at','updated_at','deleted_at','created_by_user_id']) IS DISTINCT FROM
    (to_jsonb(OLD)-ARRAY['version','created_at','updated_at','deleted_at','created_by_user_id']) THEN
    RAISE EXCEPTION 'Subscription events are managed by the server; use an override' USING ERRCODE='23514';
   END IF;
  END IF;
 END IF;
 RETURN NEW;
END; $$;
