import type { DisplayEvent, EventPatch, Occurrence, Profile, Source } from '../domain/model';
import { addDays, fromWall } from '../domain/time';
import { getDatabase, write, transaction } from './database';

const selection = `SELECT e.*,s.profileId,o.patch FROM events e JOIN sources s ON s.id=e.sourceId AND s.revision=e.revision
  LEFT JOIN overrides o ON o.sourceId=e.sourceId AND o.key=e.key`;
export async function profiles(): Promise<Profile[]> {
  return (await getDatabase()).getAllAsync<Profile>('SELECT * FROM profiles ORDER BY isOwn DESC,name,id');
}
export async function saveProfile(name: string, id?: number): Promise<void> {
  if (!name.trim()) throw new Error('Adj nevet a profilnak.');
  await write(async db => {
    const existing = await db.getAllAsync<Profile>('SELECT * FROM profiles');
    const normalizedName = name.trim().normalize('NFC').toLocaleLowerCase('hu');
    for (const profile of existing) {
      if (profile.id !== id && profile.name.trim().normalize('NFC').toLocaleLowerCase('hu') === normalizedName) throw new Error('Ilyen nevű profil már létezik. Válassz másik nevet.');
    }
    if (id) { await db.runAsync('UPDATE profiles SET name=? WHERE id=?', name.trim(), id); return; }
    await db.runAsync('INSERT INTO profiles(name,isOwn) SELECT ?,CASE WHEN EXISTS(SELECT 1 FROM profiles) THEN 0 ELSE 1 END', name.trim());
  });
}
export async function ownProfile(id: number): Promise<void> {
  await transaction(async db => {
    await db.runAsync('UPDATE profiles SET isOwn=0');
    await db.runAsync('UPDATE profiles SET isOwn=1 WHERE id=?', id);
  });
}
export async function deleteProfile(id: number): Promise<void> {
  await transaction(async db => {
    await db.runAsync('DELETE FROM events WHERE sourceId IN (SELECT id FROM sources WHERE profileId=?)', id);
    await db.runAsync('DELETE FROM profiles WHERE id=?', id);
  });
}
export async function sources(profileId?: number): Promise<Source[]> {
  const db = await getDatabase();
  if (profileId === undefined) return db.getAllAsync<Source>('SELECT * FROM sources');
  return db.getAllAsync<Source>('SELECT * FROM sources WHERE profileId=?', profileId);
}
export async function visibleEvents(profileId: number, date: string, days: number, showHidden: boolean): Promise<DisplayEvent[]> {
  const db = await getDatabase();
  return db.getAllAsync<DisplayEvent>(`${selection} WHERE s.profileId=? AND e.start<? AND (e.end>? OR (e.end=e.start AND e.start>=?)) AND (? OR e.hidden=0) ORDER BY e.start,e.end`,
    profileId, fromWall(addDays(date, days)), fromWall(date), fromWall(date), Number(showHidden));
}
export async function futureEvents(event: DisplayEvent): Promise<DisplayEvent[]> {
  return (await getDatabase()).getAllAsync<DisplayEvent>(`${selection} WHERE s.profileId=? AND e.originalTitle=? AND e.start>=? ORDER BY e.start`, event.profileId, event.originalTitle, event.start);
}
/** Applies only supplied fields and persists the patch separately from the source. */
export async function updateEvents(changes: { event: DisplayEvent; patch: EventPatch | null }[]): Promise<void> {
  await transaction(async db => {
    for (const change of changes) await updateOne(db, change.event, change.patch);
  });
}
async function updateOne(db: Awaited<ReturnType<typeof getDatabase>>, event: DisplayEvent, patch: EventPatch | null): Promise<void> {
  const base: Occurrence = JSON.parse(event.base);
  const previous: EventPatch = event.patch ? JSON.parse(event.patch) : {};
  const merged = patch === null ? {} : { ...previous, ...patch };
  const effective = { ...base, ...merged };
  if (effective.end < effective.start) throw new Error('A befejezés nem előzheti meg a kezdést.');
  if (!effective.title.trim()) throw new Error('Hiányzó eseménynév.');
  if (patch === null) await db.runAsync('DELETE FROM overrides WHERE sourceId=? AND key=?', event.sourceId, event.key);
  else await db.runAsync('INSERT OR REPLACE INTO overrides VALUES (?,?,?)', event.sourceId, event.key, JSON.stringify(merged));
  await db.runAsync('UPDATE events SET title=?,start=?,end=?,location=?,hidden=? WHERE sourceId=? AND key=? AND revision=(SELECT revision FROM sources WHERE id=?)',
    effective.title, effective.start, effective.end, effective.location, Number(effective.hidden ?? false), event.sourceId, event.key, event.sourceId);
}

/** Removes a manually created series only; imported events remain owned by their source. */
export async function deleteManualSource(sourceId: string): Promise<void> {
  await transaction(async db => {
    const source = await db.getFirstAsync<{ isManual: number }>('SELECT isManual FROM sources WHERE id=?', sourceId);
    if (!source?.isManual) throw new Error('Csak kézzel felvitt sorozat törölhető.');
    await db.runAsync('DELETE FROM events WHERE sourceId=?', sourceId);
    await db.runAsync('DELETE FROM sources WHERE id=?', sourceId);
  });
}
