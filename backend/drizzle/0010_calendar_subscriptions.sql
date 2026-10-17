CREATE TABLE "calendar_subscription_job" (
	"source_id" text PRIMARY KEY NOT NULL,
	"next_attempt_at" timestamp with time zone DEFAULT now() NOT NULL,
	"lease_until" timestamp with time zone,
	"lease_token" text,
	"generation" integer DEFAULT 0 NOT NULL,
	"failures" integer DEFAULT 0 NOT NULL,
	"etag" text,
	"last_modified" text,
	"published_at" timestamp with time zone,
	"upstream_share_id" text
);
--> statement-breakpoint
ALTER TABLE "calendar_subscription_job" ADD CONSTRAINT "calendar_subscription_job_source_id_calendar_source_id_fk" FOREIGN KEY ("source_id") REFERENCES "public"."calendar_source"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "calendar_subscription_job" ADD CONSTRAINT "calendar_subscription_job_upstream_share_id_calendar_share_id_fk" FOREIGN KEY ("upstream_share_id") REFERENCES "public"."calendar_share"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "calendar_subscription_due_idx" ON "calendar_subscription_job" USING btree ("next_attempt_at");--> statement-breakpoint
CREATE INDEX "calendar_subscription_upstream_idx" ON "calendar_subscription_job" USING btree ("upstream_share_id");--> statement-breakpoint
CREATE FUNCTION public.triton_subscription_connection() RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog,public AS $$
BEGIN
 IF TG_OP='INSERT' OR NEW.url IS DISTINCT FROM OLD.url OR NEW.deleted_at IS DISTINCT FROM OLD.deleted_at THEN
  INSERT INTO calendar_subscription_job(source_id,next_attempt_at) VALUES(NEW.source_id,now())
  ON CONFLICT(source_id) DO UPDATE SET next_attempt_at=now(),generation=calendar_subscription_job.generation+1,
   lease_until=NULL,lease_token=NULL,etag=NULL,last_modified=NULL,failures=0,published_at=NULL,upstream_share_id=NULL;
 END IF;
 RETURN NEW;
END; $$;
--> statement-breakpoint
CREATE TRIGGER triton_subscription_connection AFTER INSERT OR UPDATE ON public.calendar_source_connection FOR EACH ROW EXECUTE FUNCTION public.triton_subscription_connection();
--> statement-breakpoint
CREATE FUNCTION public.triton_subscription_changed() RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog,public AS $$
DECLARE calendar_key text;
BEGIN
 IF TG_TABLE_NAME='user_event_override' THEN
  SELECT calendar_id INTO calendar_key FROM calendar_event WHERE id=NEW.event_id;
 ELSIF TG_TABLE_NAME='calendar' THEN calendar_key:=NEW.id;
 ELSE calendar_key:=NEW.calendar_id;
 END IF;
 UPDATE calendar_subscription_job j SET next_attempt_at=now(),generation=j.generation+1
 FROM calendar_share sh WHERE sh.id=j.upstream_share_id AND sh.calendar_id=calendar_key AND j.next_attempt_at IS DISTINCT FROM now();
 RETURN NEW;
END; $$;
--> statement-breakpoint
CREATE TRIGGER triton_subscription_changed AFTER INSERT OR UPDATE ON public.calendar_event FOR EACH ROW EXECUTE FUNCTION public.triton_subscription_changed();
--> statement-breakpoint
CREATE TRIGGER triton_subscription_changed AFTER INSERT OR UPDATE ON public.user_event_override FOR EACH ROW EXECUTE FUNCTION public.triton_subscription_changed();
--> statement-breakpoint
CREATE TRIGGER triton_subscription_changed AFTER UPDATE ON public.calendar FOR EACH ROW EXECUTE FUNCTION public.triton_subscription_changed();
--> statement-breakpoint
CREATE TRIGGER triton_subscription_changed AFTER UPDATE ON public.calendar_share FOR EACH ROW EXECUTE FUNCTION public.triton_subscription_changed();
--> statement-breakpoint
CREATE FUNCTION public.triton_guard_subscription() RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog,public AS $$
BEGIN
 IF current_setting('triton.subscription_worker',true)='true' THEN RETURN NEW; END IF;
 IF EXISTS(SELECT 1 FROM calendar_subscription_job j JOIN calendar_source_connection c ON c.source_id=j.source_id
   WHERE j.source_id=NEW.source_id AND j.published_at IS NOT NULL AND c.url IS NOT NULL AND c.deleted_at IS NULL) THEN
  IF TG_TABLE_NAME='calendar_source_content' THEN
   IF TG_OP='INSERT' OR NEW.content_hash IS DISTINCT FROM OLD.content_hash THEN
    RAISE EXCEPTION 'Subscription content is managed by the server' USING ERRCODE='23514';
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
--> statement-breakpoint
CREATE TRIGGER triton_guard_subscription BEFORE INSERT OR UPDATE ON public.calendar_event FOR EACH ROW EXECUTE FUNCTION public.triton_guard_subscription();
--> statement-breakpoint
CREATE TRIGGER triton_guard_subscription BEFORE INSERT OR UPDATE ON public.calendar_source_content FOR EACH ROW EXECUTE FUNCTION public.triton_guard_subscription();
--> statement-breakpoint
INSERT INTO calendar_subscription_job(source_id,next_attempt_at)
 SELECT c.source_id,now()+random()*interval '15 minutes' FROM calendar_source_connection c JOIN calendar_source s ON s.id=c.source_id
 WHERE c.url IS NOT NULL AND c.deleted_at IS NULL AND s.deleted_at IS NULL AND s.format='ics' ON CONFLICT DO NOTHING;
