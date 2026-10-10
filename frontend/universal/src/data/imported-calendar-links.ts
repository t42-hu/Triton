import { getDatabase, transaction } from './database';
export type ImportedCalendar = { sourceId: string; name: string; profileName: string; url: string; eventCount: number };
export async function importedCalendars(): Promise<ImportedCalendar[]> {
  return (await getDatabase()).getAllAsync<ImportedCalendar>(`SELECT s.id AS sourceId,s.name,p.name AS profileName,c.url,
    (SELECT count(*) FROM events e WHERE e.sourceId=s.id AND e.revision=s.revision) AS eventCount
    FROM sources s JOIN profiles p ON p.id=s.profileId JOIN source_sync c ON c.sourceId=s.id
    WHERE s.isManual=0 AND c.url IS NOT NULL ORDER BY p.isOwn DESC,p.name,s.name`);
}
/** Deletes exactly one subscription and its occurrences; source foreign keys clean up tasks and reminders. */
export async function removeImportedCalendar(sourceId: string): Promise<void> {
  await transaction(async db => {
    const source = await db.getFirstAsync(`SELECT s.id FROM sources s JOIN source_sync c ON c.sourceId=s.id WHERE s.id=? AND s.isManual=0 AND c.url IS NOT NULL`, sourceId);
    if (!source) throw new Error('Az importált naptárlink már nem található.');
    await db.runAsync('DELETE FROM events WHERE sourceId=?', sourceId);
    await db.runAsync('DELETE FROM sources WHERE id=?', sourceId);
  }, true);
}
