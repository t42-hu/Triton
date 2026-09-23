import type { DisplayEvent } from '../domain/model';
import { DEFAULT_REMINDERS, EMPTY_EVENT_REMINDERS, REMINDER_WINDOW, validateReminderRules, type EventReminders, type GlobalReminders, type ReminderEvent } from '../domain/reminders';
import { getDatabase, readSetting, saveSetting, transaction } from './database';

export async function globalReminders(): Promise<GlobalReminders> { return readSetting('classReminders', DEFAULT_REMINDERS); }
export async function saveGlobalReminders(value: GlobalReminders): Promise<void> {
  validateReminderRules(value.rules);
  if (value.enabled && !value.rules.length) throw new Error('Adj meg legalább egy előjelzést.');
  await saveSetting('classReminders', value);
}
export async function eventReminders(event: Pick<DisplayEvent, 'sourceId' | 'key'>): Promise<EventReminders> {
  const row = await (await getDatabase()).getFirstAsync<{ excludeGlobal: number; rules: string }>('SELECT excludeGlobal,rules FROM event_reminders WHERE sourceId=? AND key=?', event.sourceId, event.key);
  return row ? { excludeGlobal: Boolean(row.excludeGlobal), rules: JSON.parse(row.rules) } : EMPTY_EVENT_REMINDERS;
}
/** Occurrence identity survives edits/import refreshes, but cannot attach to a deleted event. */
export async function saveEventReminders(event: Pick<DisplayEvent, 'sourceId' | 'key'>, value: EventReminders): Promise<void> {
  validateReminderRules(value.rules);
  await transaction(async db => {
    const exists = await db.getFirstAsync('SELECT e.key FROM events e JOIN sources s ON e.sourceId=s.id AND e.revision=s.revision WHERE e.sourceId=? AND e.key=?', event.sourceId, event.key);
    if (!exists) throw new Error('Ez az alkalom már nem szerepel az órarendben.');
    if (!value.excludeGlobal && !value.rules.length) { await db.runAsync('DELETE FROM event_reminders WHERE sourceId=? AND key=?', event.sourceId, event.key); return; }
    await db.runAsync('INSERT OR REPLACE INTO event_reminders VALUES (?,?,?,?)', event.sourceId, event.key, Number(value.excludeGlobal), JSON.stringify(value.rules));
  });
}
export async function hasReminders(): Promise<boolean> {
  if ((await globalReminders()).enabled) return true;
  return Boolean(await (await getDatabase()).getFirstAsync("SELECT sourceId FROM event_reminders WHERE rules<>'[]' LIMIT 1"));
}
/** Reads only active source revisions in the upcoming scheduling window. */
export async function reminderEvents(now: number): Promise<ReminderEvent[]> {
  const rows = await (await getDatabase()).getAllAsync<ReminderEvent & { excludeGlobal: number | null; rules: string | null }>(`SELECT e.*,p.isOwn,r.excludeGlobal,r.rules FROM events e
    JOIN sources s ON s.id=e.sourceId AND s.revision=e.revision JOIN profiles p ON p.id=s.profileId
    LEFT JOIN event_reminders r ON r.sourceId=e.sourceId AND r.key=e.key
    WHERE e.hidden=0 AND e.start>? AND e.start<=? AND (p.isOwn=1 OR r.rules IS NOT NULL)`, now, now + REMINDER_WINDOW + 7 * 86400000);
  return rows.map(row => ({ ...row, reminders: { excludeGlobal: Boolean(row.excludeGlobal), rules: row.rules ? JSON.parse(row.rules) : [] } }));
}
