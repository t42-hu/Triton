import type { DisplayEvent, Profile } from '../domain/model';
import { exportCalendar } from '../domain/calendar-export';
import { calendarShareOptions } from './calendar-links';
import { getDatabase, readSetting } from './database';
import { saveCalendarFile } from './save-calendar-file';

/** Export and native sharing obey the same own-profile restriction as live links. */
export async function exportProfile(profile: Profile): Promise<void> {
  const db = await getDatabase();
  const own = await db.getFirstAsync<Profile>('SELECT * FROM profiles WHERE id=? AND isOwn=1', profile.id);
  const sync = await readSetting<{ identities: Record<string, string> } | null>('cloudSync', null);
  const allowed = own && (await calendarShareOptions()).some(option => option.calendarId === sync?.identities[`calendars:${profile.id}`]);
  if (!allowed) throw new Error('Csak a saját profilod órarendjét tudod exportálni.');
  const events = await (await getDatabase()).getAllAsync<DisplayEvent>(`SELECT e.*, s.profileId FROM events e JOIN sources s ON s.id=e.sourceId AND s.revision=e.revision WHERE s.profileId=? AND e.hidden=0 ORDER BY e.start,e.end`, profile.id);
  const filename = `${profile.name.replace(/[^\p{L}\p{N}_-]/gu, '_') || 'orarend'}.ics`;
  await saveCalendarFile(filename, exportCalendar(profile, events));
}
