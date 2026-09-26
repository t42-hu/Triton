import starterCalendars from '../../assets/calendars/starter-calendars.json';
import { readSetting, saveSetting } from './database';
import { discardStages, publishStages, sourceById, stageSource } from './importer';
import { profiles, saveProfile } from './repository';

let pendingSeed: Promise<void> | undefined;

/** Installs the supplied calendars once while preserving existing profile data. */
export function seedStarterProfiles(): Promise<void> {
  pendingSeed ??= installStarterProfiles().finally(() => { pendingSeed = undefined; });
  return pendingSeed;
}

async function installStarterProfiles(): Promise<void> {
  if (await readSetting('starterProfilesV1', false)) return;
  for (const calendar of starterCalendars) await installCalendar(calendar);
  await saveSetting('starterProfilesV1', true);
}

async function installCalendar(calendar: (typeof starterCalendars)[number]): Promise<void> {
  const name = calendar.name.trim().normalize('NFC').toLocaleLowerCase('hu');
  const existing = (await profiles()).find(profile => profile.name.trim().normalize('NFC').toLocaleLowerCase('hu') === name);
  const profileId = existing?.id ?? await saveProfile(calendar.name);
  const sourceId = `${profileId}:import`;
  if (await sourceById(sourceId)) return;
  const input = { id: sourceId, profileId, content: calendar.content, name: calendar.filename,
    format: 'ics' as const, isManual: 0, fromDate: '2026-09-01', toDate: '2026-12-31' };
  const control = { signal: new AbortController().signal, progress: () => undefined };
  const stage = await stageSource(input, { date: '2026-09-07', week: 'A' }, control);
  if (!stage.count) { await discardStages([stage]); throw new Error(`${calendar.name}: üres naptár.`); }
  stage.connection = null;
  try { await publishStages([stage]); }
  catch (error) { await discardStages([stage]); throw error; }
}
