-- A sequence alone is not commit-ordered. Serialize domain write transactions
-- before taking row locks so a cursor cannot skip a transaction committing late.
-- This deliberately favors correctness over write throughput for the initial app.
CREATE FUNCTION public.triton_lock_sync_write() RETURNS trigger
LANGUAGE plpgsql SET search_path = pg_catalog, public AS $$
BEGIN
    PERFORM pg_advisory_xact_lock(78416823849321::bigint);
    RETURN NULL;
END;
$$;
--> statement-breakpoint
CREATE FUNCTION public.triton_stamp_record() RETURNS trigger
LANGUAGE plpgsql SET search_path = pg_catalog, public AS $$
DECLARE column_name text;
BEGIN
    IF TG_OP = 'INSERT' THEN
        NEW.version := 1;
    ELSE
        IF NEW.id IS DISTINCT FROM OLD.id THEN
            RAISE EXCEPTION 'Record identity cannot change' USING ERRCODE = '23514';
        END IF;
        -- Changing scope in place would leave stale copies on another user's devices.
        FOREACH column_name IN ARRAY TG_ARGV LOOP
            IF to_jsonb(NEW) -> column_name IS DISTINCT FROM to_jsonb(OLD) -> column_name THEN
                RAISE EXCEPTION 'Record scope cannot change: %', column_name USING ERRCODE = '23514';
            END IF;
        END LOOP;
        NEW.created_at := OLD.created_at;
        NEW.version := OLD.version + 1;
    END IF;
    NEW.updated_at := clock_timestamp();
    RETURN NEW;
END;
$$;
--> statement-breakpoint
CREATE FUNCTION public.triton_log_change() RETURNS trigger
LANGUAGE plpgsql SET search_path = pg_catalog, public AS $$
DECLARE
    item jsonb;
    scope_id text;
    scope_kind text := TG_ARGV[0];
    affected_user text;
    event_calendar_id text;
BEGIN
    IF TG_OP = 'DELETE' THEN item := to_jsonb(OLD); ELSE item := to_jsonb(NEW); END IF;
    scope_id := item ->> TG_ARGV[1];
    IF scope_kind = 'source_calendar' THEN
        SELECT calendar_id INTO scope_id FROM public.calendar_source WHERE id = scope_id;
        scope_kind := 'calendar';
    ELSIF scope_kind = 'source_owner' THEN
        SELECT c.owner_user_id INTO scope_id FROM public.calendar_source s
        JOIN public.calendar c ON c.id = s.calendar_id WHERE s.id = scope_id;
        scope_kind := 'user';
    ELSIF scope_kind = 'meeting_event' THEN
        SELECT event_id INTO scope_id FROM public.meeting WHERE id = scope_id;
        scope_kind := 'event';
    END IF;
    -- During a physical parent cascade its own deletion notice covers its children.
    IF scope_id IS NULL THEN RETURN NULL; END IF;
    IF scope_kind = 'event' THEN
        IF TG_TABLE_NAME = 'calendar_event' THEN
            event_calendar_id := item ->> 'calendar_id';
        ELSE
            SELECT calendar_id INTO event_calendar_id FROM public.calendar_event WHERE id = scope_id;
        END IF;
    END IF;
    IF array_length(TG_ARGV, 1) > 2 THEN affected_user := item ->> TG_ARGV[2]; END IF;
    INSERT INTO public.sync_change(entity_type, entity_id, operation, version,
        user_id, calendar_id, event_id, affected_user_id)
    VALUES (TG_TABLE_NAME, item ->> 'id',
        CASE WHEN TG_OP = 'DELETE' OR item ->> 'deleted_at' IS NOT NULL THEN 'delete' ELSE 'upsert' END,
        (item ->> 'version')::integer + CASE WHEN TG_OP = 'DELETE' THEN 1 ELSE 0 END,
        CASE WHEN scope_kind = 'user' THEN scope_id END,
        CASE WHEN scope_kind = 'calendar' THEN scope_id ELSE event_calendar_id END,
        CASE WHEN scope_kind = 'event' THEN scope_id END, affected_user);
    RETURN NULL;
END;
$$;

--> statement-breakpoint
CREATE TRIGGER triton_sync_lock BEFORE INSERT OR UPDATE OR DELETE ON public.calendar
FOR EACH STATEMENT EXECUTE FUNCTION public.triton_lock_sync_write();
--> statement-breakpoint
CREATE TRIGGER triton_record_stamp BEFORE INSERT OR UPDATE ON public.calendar
FOR EACH ROW EXECUTE FUNCTION public.triton_stamp_record('owner_user_id');
--> statement-breakpoint
CREATE TRIGGER triton_record_change AFTER INSERT OR UPDATE OR DELETE ON public.calendar
FOR EACH ROW EXECUTE FUNCTION public.triton_log_change('calendar', 'id');

--> statement-breakpoint
CREATE TRIGGER triton_sync_lock BEFORE INSERT OR UPDATE OR DELETE ON public.calendar_member
FOR EACH STATEMENT EXECUTE FUNCTION public.triton_lock_sync_write();
--> statement-breakpoint
CREATE TRIGGER triton_record_stamp BEFORE INSERT OR UPDATE ON public.calendar_member
FOR EACH ROW EXECUTE FUNCTION public.triton_stamp_record('calendar_id', 'user_id');
--> statement-breakpoint
CREATE TRIGGER triton_record_change AFTER INSERT OR UPDATE OR DELETE ON public.calendar_member
FOR EACH ROW EXECUTE FUNCTION public.triton_log_change('calendar', 'calendar_id', 'user_id');

--> statement-breakpoint
CREATE TRIGGER triton_sync_lock BEFORE INSERT OR UPDATE OR DELETE ON public.calendar_invitation
FOR EACH STATEMENT EXECUTE FUNCTION public.triton_lock_sync_write();
--> statement-breakpoint
CREATE TRIGGER triton_record_stamp BEFORE INSERT OR UPDATE ON public.calendar_invitation
FOR EACH ROW EXECUTE FUNCTION public.triton_stamp_record('calendar_id', 'invited_by_user_id', 'invited_user_id', 'invited_email');
--> statement-breakpoint
CREATE TRIGGER triton_record_change AFTER INSERT OR UPDATE OR DELETE ON public.calendar_invitation
FOR EACH ROW EXECUTE FUNCTION public.triton_log_change('user', 'invited_by_user_id', 'invited_user_id');

--> statement-breakpoint
CREATE TRIGGER triton_sync_lock BEFORE INSERT OR UPDATE OR DELETE ON public.calendar_source
FOR EACH STATEMENT EXECUTE FUNCTION public.triton_lock_sync_write();
--> statement-breakpoint
CREATE TRIGGER triton_record_stamp BEFORE INSERT OR UPDATE ON public.calendar_source
FOR EACH ROW EXECUTE FUNCTION public.triton_stamp_record('calendar_id');
--> statement-breakpoint
CREATE TRIGGER triton_record_change AFTER INSERT OR UPDATE OR DELETE ON public.calendar_source
FOR EACH ROW EXECUTE FUNCTION public.triton_log_change('calendar', 'calendar_id');

--> statement-breakpoint
CREATE TRIGGER triton_sync_lock BEFORE INSERT OR UPDATE OR DELETE ON public.calendar_source_connection
FOR EACH STATEMENT EXECUTE FUNCTION public.triton_lock_sync_write();
--> statement-breakpoint
CREATE TRIGGER triton_record_stamp BEFORE INSERT OR UPDATE ON public.calendar_source_connection
FOR EACH ROW EXECUTE FUNCTION public.triton_stamp_record('source_id');
--> statement-breakpoint
CREATE TRIGGER triton_record_change AFTER INSERT OR UPDATE OR DELETE ON public.calendar_source_connection
FOR EACH ROW EXECUTE FUNCTION public.triton_log_change('source_owner', 'source_id');

--> statement-breakpoint
CREATE TRIGGER triton_sync_lock BEFORE INSERT OR UPDATE OR DELETE ON public.calendar_source_revision
FOR EACH STATEMENT EXECUTE FUNCTION public.triton_lock_sync_write();
--> statement-breakpoint
CREATE TRIGGER triton_record_stamp BEFORE INSERT OR UPDATE ON public.calendar_source_revision
FOR EACH ROW EXECUTE FUNCTION public.triton_stamp_record('source_id');
--> statement-breakpoint
CREATE TRIGGER triton_record_change AFTER INSERT OR UPDATE OR DELETE ON public.calendar_source_revision
FOR EACH ROW EXECUTE FUNCTION public.triton_log_change('source_calendar', 'source_id');

--> statement-breakpoint
CREATE TRIGGER triton_sync_lock BEFORE INSERT OR UPDATE OR DELETE ON public.calendar_event
FOR EACH STATEMENT EXECUTE FUNCTION public.triton_lock_sync_write();
--> statement-breakpoint
CREATE TRIGGER triton_record_stamp BEFORE INSERT OR UPDATE ON public.calendar_event
FOR EACH ROW EXECUTE FUNCTION public.triton_stamp_record('calendar_id', 'source_id', 'external_uid');
--> statement-breakpoint
CREATE TRIGGER triton_record_change AFTER INSERT OR UPDATE OR DELETE ON public.calendar_event
FOR EACH ROW EXECUTE FUNCTION public.triton_log_change('event', 'id');

--> statement-breakpoint
CREATE TRIGGER triton_sync_lock BEFORE INSERT OR UPDATE OR DELETE ON public.event_attachment
FOR EACH STATEMENT EXECUTE FUNCTION public.triton_lock_sync_write();
--> statement-breakpoint
CREATE TRIGGER triton_record_stamp BEFORE INSERT OR UPDATE ON public.event_attachment
FOR EACH ROW EXECUTE FUNCTION public.triton_stamp_record('event_id', 'occurrence_key');
--> statement-breakpoint
CREATE TRIGGER triton_record_change AFTER INSERT OR UPDATE OR DELETE ON public.event_attachment
FOR EACH ROW EXECUTE FUNCTION public.triton_log_change('event', 'event_id');

--> statement-breakpoint
CREATE TRIGGER triton_sync_lock BEFORE INSERT OR UPDATE OR DELETE ON public.event_exception
FOR EACH STATEMENT EXECUTE FUNCTION public.triton_lock_sync_write();
--> statement-breakpoint
CREATE TRIGGER triton_record_stamp BEFORE INSERT OR UPDATE ON public.event_exception
FOR EACH ROW EXECUTE FUNCTION public.triton_stamp_record('event_id', 'occurrence_key');
--> statement-breakpoint
CREATE TRIGGER triton_record_change AFTER INSERT OR UPDATE OR DELETE ON public.event_exception
FOR EACH ROW EXECUTE FUNCTION public.triton_log_change('event', 'event_id');

--> statement-breakpoint
CREATE TRIGGER triton_sync_lock BEFORE INSERT OR UPDATE OR DELETE ON public.event_recurrence
FOR EACH STATEMENT EXECUTE FUNCTION public.triton_lock_sync_write();
--> statement-breakpoint
CREATE TRIGGER triton_record_stamp BEFORE INSERT OR UPDATE ON public.event_recurrence
FOR EACH ROW EXECUTE FUNCTION public.triton_stamp_record('event_id');
--> statement-breakpoint
CREATE TRIGGER triton_record_change AFTER INSERT OR UPDATE OR DELETE ON public.event_recurrence
FOR EACH ROW EXECUTE FUNCTION public.triton_log_change('event', 'event_id');

--> statement-breakpoint
CREATE TRIGGER triton_sync_lock BEFORE INSERT OR UPDATE OR DELETE ON public.meeting
FOR EACH STATEMENT EXECUTE FUNCTION public.triton_lock_sync_write();
--> statement-breakpoint
CREATE TRIGGER triton_record_stamp BEFORE INSERT OR UPDATE ON public.meeting
FOR EACH ROW EXECUTE FUNCTION public.triton_stamp_record('event_id', 'organizer_user_id');
--> statement-breakpoint
CREATE TRIGGER triton_record_change AFTER INSERT OR UPDATE OR DELETE ON public.meeting
FOR EACH ROW EXECUTE FUNCTION public.triton_log_change('event', 'event_id');

--> statement-breakpoint
CREATE TRIGGER triton_sync_lock BEFORE INSERT OR UPDATE OR DELETE ON public.meeting_participant
FOR EACH STATEMENT EXECUTE FUNCTION public.triton_lock_sync_write();
--> statement-breakpoint
CREATE TRIGGER triton_record_stamp BEFORE INSERT OR UPDATE ON public.meeting_participant
FOR EACH ROW EXECUTE FUNCTION public.triton_stamp_record('meeting_id', 'user_id');
--> statement-breakpoint
CREATE TRIGGER triton_record_change AFTER INSERT OR UPDATE OR DELETE ON public.meeting_participant
FOR EACH ROW EXECUTE FUNCTION public.triton_log_change('meeting_event', 'meeting_id', 'user_id');

--> statement-breakpoint
CREATE TRIGGER triton_sync_lock BEFORE INSERT OR UPDATE OR DELETE ON public.schedule_profile
FOR EACH STATEMENT EXECUTE FUNCTION public.triton_lock_sync_write();
--> statement-breakpoint
CREATE TRIGGER triton_record_stamp BEFORE INSERT OR UPDATE ON public.schedule_profile
FOR EACH ROW EXECUTE FUNCTION public.triton_stamp_record('user_id');
--> statement-breakpoint
CREATE TRIGGER triton_record_change AFTER INSERT OR UPDATE OR DELETE ON public.schedule_profile
FOR EACH ROW EXECUTE FUNCTION public.triton_log_change('user', 'user_id');

--> statement-breakpoint
CREATE TRIGGER triton_sync_lock BEFORE INSERT OR UPDATE OR DELETE ON public.schedule_profile_calendar
FOR EACH STATEMENT EXECUTE FUNCTION public.triton_lock_sync_write();
--> statement-breakpoint
CREATE TRIGGER triton_record_stamp BEFORE INSERT OR UPDATE ON public.schedule_profile_calendar
FOR EACH ROW EXECUTE FUNCTION public.triton_stamp_record('user_id');
--> statement-breakpoint
CREATE TRIGGER triton_record_change AFTER INSERT OR UPDATE OR DELETE ON public.schedule_profile_calendar
FOR EACH ROW EXECUTE FUNCTION public.triton_log_change('user', 'user_id');

--> statement-breakpoint
CREATE TRIGGER triton_sync_lock BEFORE INSERT OR UPDATE OR DELETE ON public.user_calendar_preference
FOR EACH STATEMENT EXECUTE FUNCTION public.triton_lock_sync_write();
--> statement-breakpoint
CREATE TRIGGER triton_record_stamp BEFORE INSERT OR UPDATE ON public.user_calendar_preference
FOR EACH ROW EXECUTE FUNCTION public.triton_stamp_record('user_id');
--> statement-breakpoint
CREATE TRIGGER triton_record_change AFTER INSERT OR UPDATE OR DELETE ON public.user_calendar_preference
FOR EACH ROW EXECUTE FUNCTION public.triton_log_change('user', 'user_id');

--> statement-breakpoint
CREATE TRIGGER triton_sync_lock BEFORE INSERT OR UPDATE OR DELETE ON public.user_color_preset
FOR EACH STATEMENT EXECUTE FUNCTION public.triton_lock_sync_write();
--> statement-breakpoint
CREATE TRIGGER triton_record_stamp BEFORE INSERT OR UPDATE ON public.user_color_preset
FOR EACH ROW EXECUTE FUNCTION public.triton_stamp_record('user_id');
--> statement-breakpoint
CREATE TRIGGER triton_record_change AFTER INSERT OR UPDATE OR DELETE ON public.user_color_preset
FOR EACH ROW EXECUTE FUNCTION public.triton_log_change('user', 'user_id');

--> statement-breakpoint
CREATE TRIGGER triton_sync_lock BEFORE INSERT OR UPDATE OR DELETE ON public.user_color_preset_color
FOR EACH STATEMENT EXECUTE FUNCTION public.triton_lock_sync_write();
--> statement-breakpoint
CREATE TRIGGER triton_record_stamp BEFORE INSERT OR UPDATE ON public.user_color_preset_color
FOR EACH ROW EXECUTE FUNCTION public.triton_stamp_record('user_id');
--> statement-breakpoint
CREATE TRIGGER triton_record_change AFTER INSERT OR UPDATE OR DELETE ON public.user_color_preset_color
FOR EACH ROW EXECUTE FUNCTION public.triton_log_change('user', 'user_id');

--> statement-breakpoint
CREATE TRIGGER triton_sync_lock BEFORE INSERT OR UPDATE OR DELETE ON public.user_color_rule
FOR EACH STATEMENT EXECUTE FUNCTION public.triton_lock_sync_write();
--> statement-breakpoint
CREATE TRIGGER triton_record_stamp BEFORE INSERT OR UPDATE ON public.user_color_rule
FOR EACH ROW EXECUTE FUNCTION public.triton_stamp_record('user_id');
--> statement-breakpoint
CREATE TRIGGER triton_record_change AFTER INSERT OR UPDATE OR DELETE ON public.user_color_rule
FOR EACH ROW EXECUTE FUNCTION public.triton_log_change('user', 'user_id');

--> statement-breakpoint
CREATE TRIGGER triton_sync_lock BEFORE INSERT OR UPDATE OR DELETE ON public.user_device
FOR EACH STATEMENT EXECUTE FUNCTION public.triton_lock_sync_write();
--> statement-breakpoint
CREATE TRIGGER triton_record_stamp BEFORE INSERT OR UPDATE ON public.user_device
FOR EACH ROW EXECUTE FUNCTION public.triton_stamp_record('user_id');
--> statement-breakpoint
CREATE TRIGGER triton_record_change AFTER INSERT OR UPDATE OR DELETE ON public.user_device
FOR EACH ROW EXECUTE FUNCTION public.triton_log_change('user', 'user_id');

--> statement-breakpoint
CREATE TRIGGER triton_sync_lock BEFORE INSERT OR UPDATE OR DELETE ON public.user_device_preference
FOR EACH STATEMENT EXECUTE FUNCTION public.triton_lock_sync_write();
--> statement-breakpoint
CREATE TRIGGER triton_record_stamp BEFORE INSERT OR UPDATE ON public.user_device_preference
FOR EACH ROW EXECUTE FUNCTION public.triton_stamp_record('user_id');
--> statement-breakpoint
CREATE TRIGGER triton_record_change AFTER INSERT OR UPDATE OR DELETE ON public.user_device_preference
FOR EACH ROW EXECUTE FUNCTION public.triton_log_change('user', 'user_id');

--> statement-breakpoint
CREATE TRIGGER triton_sync_lock BEFORE INSERT OR UPDATE OR DELETE ON public.user_event_override
FOR EACH STATEMENT EXECUTE FUNCTION public.triton_lock_sync_write();
--> statement-breakpoint
CREATE TRIGGER triton_record_stamp BEFORE INSERT OR UPDATE ON public.user_event_override
FOR EACH ROW EXECUTE FUNCTION public.triton_stamp_record('user_id');
--> statement-breakpoint
CREATE TRIGGER triton_record_change AFTER INSERT OR UPDATE OR DELETE ON public.user_event_override
FOR EACH ROW EXECUTE FUNCTION public.triton_log_change('user', 'user_id');

--> statement-breakpoint
CREATE TRIGGER triton_sync_lock BEFORE INSERT OR UPDATE OR DELETE ON public.user_event_reminder_setting
FOR EACH STATEMENT EXECUTE FUNCTION public.triton_lock_sync_write();
--> statement-breakpoint
CREATE TRIGGER triton_record_stamp BEFORE INSERT OR UPDATE ON public.user_event_reminder_setting
FOR EACH ROW EXECUTE FUNCTION public.triton_stamp_record('user_id');
--> statement-breakpoint
CREATE TRIGGER triton_record_change AFTER INSERT OR UPDATE OR DELETE ON public.user_event_reminder_setting
FOR EACH ROW EXECUTE FUNCTION public.triton_log_change('user', 'user_id');

--> statement-breakpoint
CREATE TRIGGER triton_sync_lock BEFORE INSERT OR UPDATE OR DELETE ON public.user_notebook_link
FOR EACH STATEMENT EXECUTE FUNCTION public.triton_lock_sync_write();
--> statement-breakpoint
CREATE TRIGGER triton_record_stamp BEFORE INSERT OR UPDATE ON public.user_notebook_link
FOR EACH ROW EXECUTE FUNCTION public.triton_stamp_record('user_id');
--> statement-breakpoint
CREATE TRIGGER triton_record_change AFTER INSERT OR UPDATE OR DELETE ON public.user_notebook_link
FOR EACH ROW EXECUTE FUNCTION public.triton_log_change('user', 'user_id');

--> statement-breakpoint
CREATE TRIGGER triton_sync_lock BEFORE INSERT OR UPDATE OR DELETE ON public.user_preference
FOR EACH STATEMENT EXECUTE FUNCTION public.triton_lock_sync_write();
--> statement-breakpoint
CREATE TRIGGER triton_record_stamp BEFORE INSERT OR UPDATE ON public.user_preference
FOR EACH ROW EXECUTE FUNCTION public.triton_stamp_record('user_id');
--> statement-breakpoint
CREATE TRIGGER triton_record_change AFTER INSERT OR UPDATE OR DELETE ON public.user_preference
FOR EACH ROW EXECUTE FUNCTION public.triton_log_change('user', 'user_id');

--> statement-breakpoint
CREATE TRIGGER triton_sync_lock BEFORE INSERT OR UPDATE OR DELETE ON public.user_reminder_rule
FOR EACH STATEMENT EXECUTE FUNCTION public.triton_lock_sync_write();
--> statement-breakpoint
CREATE TRIGGER triton_record_stamp BEFORE INSERT OR UPDATE ON public.user_reminder_rule
FOR EACH ROW EXECUTE FUNCTION public.triton_stamp_record('user_id');
--> statement-breakpoint
CREATE TRIGGER triton_record_change AFTER INSERT OR UPDATE OR DELETE ON public.user_reminder_rule
FOR EACH ROW EXECUTE FUNCTION public.triton_log_change('user', 'user_id');

--> statement-breakpoint
CREATE TRIGGER triton_sync_lock BEFORE INSERT OR UPDATE OR DELETE ON public.user_reminder_setting
FOR EACH STATEMENT EXECUTE FUNCTION public.triton_lock_sync_write();
--> statement-breakpoint
CREATE TRIGGER triton_record_stamp BEFORE INSERT OR UPDATE ON public.user_reminder_setting
FOR EACH ROW EXECUTE FUNCTION public.triton_stamp_record('user_id');
--> statement-breakpoint
CREATE TRIGGER triton_record_change AFTER INSERT OR UPDATE OR DELETE ON public.user_reminder_setting
FOR EACH ROW EXECUTE FUNCTION public.triton_log_change('user', 'user_id');

--> statement-breakpoint
CREATE TRIGGER triton_sync_lock BEFORE INSERT OR UPDATE OR DELETE ON public.user_task
FOR EACH STATEMENT EXECUTE FUNCTION public.triton_lock_sync_write();
--> statement-breakpoint
CREATE TRIGGER triton_record_stamp BEFORE INSERT OR UPDATE ON public.user_task
FOR EACH ROW EXECUTE FUNCTION public.triton_stamp_record('user_id');
--> statement-breakpoint
CREATE TRIGGER triton_record_change AFTER INSERT OR UPDATE OR DELETE ON public.user_task
FOR EACH ROW EXECUTE FUNCTION public.triton_log_change('user', 'user_id');
