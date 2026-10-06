import type { Anchor, CalendarEvent, DisplayEvent } from '../domain/model';
import { discardStages, publishStages, stageSource, uniqueId } from './importer';
import { getDatabase } from './database';
import { wallTime } from '../domain/time';

/** Uses the existing staged import path for every manually created event category. */
export async function createManualEvent(profileId: number, event: CalendarEvent, anchor: Anchor): Promise<DisplayEvent> {
  const sourceId = `${profileId}:manual:${uniqueId()}`;
  const stage = await stageSource({ id: sourceId, profileId, format: 'json', content: JSON.stringify({ version: 1, events: [event] }), name: event.title,
    fromDate: localDate(event.start, event.kind), toDate: event.recurrence?.until ?? localDate(event.end, event.kind), isManual: 1 }, anchor, { signal: new AbortController().signal, progress: () => undefined });
  if (!stage.count) { await discardStages([stage]); throw new Error('Ebben az időszakban nincs alkalom. Ellenőrizd az ismétlődést.'); }
  try { await publishStages([stage]); } finally { await discardStages([stage]); }
  const result = await (await getDatabase()).getFirstAsync<DisplayEvent>('SELECT e.*,s.profileId,NULL patch FROM events e JOIN sources s ON s.id=e.sourceId AND s.revision=e.revision WHERE s.id=? ORDER BY e.start LIMIT 1', sourceId);
  if (!result) throw new Error('Nem jött létre esemény. Ellenőrizd az ismétlődési időszakot.');
  return result;
}
function localDate(value: string, kind: CalendarEvent['kind']): string {
  return kind === 'allDay' ? value.slice(0, 10) : wallTime(Date.parse(value)).slice(0, 10);
}
