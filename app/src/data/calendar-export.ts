import type { DisplayEvent, Profile } from '../domain/model';
import { exportCalendar } from '../domain/calendar-export';
import { getDatabase } from './database';
import { saveCalendarFile } from './save-calendar-file';

/** Includes every published source and effective override in the selected profile. */
export async function exportProfile(profile: Profile): Promise<void> {
  const events = await (await getDatabase()).getAllAsync<DisplayEvent>(`SELECT e.*, s.profileId FROM events e JOIN sources s ON s.id=e.sourceId AND s.revision=e.revision WHERE s.profileId=? AND e.hidden=0 ORDER BY e.start,e.end`, profile.id);
  const filename = `${profile.name.replace(/[^\p{L}\p{N}_-]/gu, '_') || 'orarend'}.ics`;
  await saveCalendarFile(filename, exportCalendar(profile, events));
}
