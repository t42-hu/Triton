import { getDatabase, readSetting, transaction, write } from './database';
import { changeSummary, discardStages, publishStages, sourceById, stageSource, type StagedSource } from './importer';
import { fetchCalendar } from './calendar-fetch';
import { monday, today } from '../domain/time';
import type { Anchor } from '../domain/model';

export const SYNC_INTERVAL = 15 * 60 * 1000;
export type SyncStatus = { sourceId: string; url: string | null; autoSync: number; importedAt: number; lastAttempt: number; lastSuccess: number; lastError: string; lastChange: string };
export type SyncResult = { status: 'skipped' | 'success' | 'failed'; summary?: string; revision?: string };

export async function syncStatus(sourceId: string): Promise<SyncStatus | null> {
  return (await getDatabase()).getFirstAsync<SyncStatus>('SELECT * FROM source_sync WHERE sourceId=?', sourceId);
}
/** Scheduled checks share a cooldown; opening explicitly checks each saved link. */
async function claimSync(now: number, sourceId?: string, scheduled = false): Promise<SyncStatus | null> {
  return transaction(async db => {
    const source = await db.getFirstAsync<SyncStatus>(`SELECT c.* FROM source_sync c JOIN sources s ON s.id=c.sourceId JOIN profiles p ON p.id=s.profileId WHERE c.url IS NOT NULL AND s.isManual=0 AND ((? IS NOT NULL AND s.id=?) OR (? IS NULL AND p.isOwn=1 AND c.autoSync=1))`, sourceId ?? null, sourceId ?? null, sourceId ?? null);
    if (!source || ((!sourceId || scheduled) && now - source.lastAttempt < SYNC_INTERVAL)) return null;
    await db.runAsync('UPDATE source_sync SET lastAttempt=? WHERE sourceId=?', now, source.sourceId);
    return source;
  });
}

let opening: Promise<SyncResult[]> | null = null;
/** Check every saved link on open, including links imported by older web builds. */
export function refreshLinkedCalendars(): Promise<SyncResult[]> {
  if (opening) return opening;
  opening = refreshLinks().finally(() => { opening = null; });
  return opening;
}
async function refreshLinks(): Promise<SyncResult[]> {
  const links = await (await getDatabase()).getAllAsync<{ sourceId: string }>('SELECT c.sourceId FROM source_sync c JOIN sources s ON s.id=c.sourceId WHERE c.url IS NOT NULL AND s.isManual=0');
  const results: SyncResult[] = [];
  for (const link of links) results.push(await syncOwnCalendar(Date.now(), link.sourceId));
  return results;
}
/** Scheduled refresh checks every subscription, including shared and legacy links. */
export async function refreshDueLinkedCalendars(now = Date.now()): Promise<SyncResult> {
  const links = await (await getDatabase()).getAllAsync<{ sourceId: string }>('SELECT c.sourceId FROM source_sync c JOIN sources s ON s.id=c.sourceId WHERE c.url IS NOT NULL AND s.isManual=0');
  const results: SyncResult[] = [];
  for (const link of links) results.push(await syncCalendar(now, link.sourceId, true));
  return {
    status: results.some(result => result.status === 'failed') ? 'failed' : results.some(result => result.status === 'success') ? 'success' : 'skipped',
    summary: results.map(result => result.summary).filter(Boolean).join(' '),
    revision: results.map(result => result.revision).filter(Boolean).join('-'),
  };
}
export async function syncOwnCalendar(now = Date.now(), sourceId?: string): Promise<SyncResult> {
  return syncCalendar(now, sourceId);
}
async function syncCalendar(now: number, sourceId?: string, scheduled = false): Promise<SyncResult> {
  const subscription = await claimSync(now, sourceId, scheduled);
  if (!subscription?.url) return { status: 'skipped' };
  let stage: StagedSource | undefined;
  try {
    const source = await sourceById(subscription.sourceId);
    if (!source) return { status: 'skipped' };
    const content = await fetchCalendar(subscription.url);
    if (content === source.content) return await recordUnchanged(subscription, source.revision, now, !sourceId);
    const anchor = await readSetting<Anchor>('anchor', { date: monday(today()), week: 'A' });
    stage = await stageSource({ ...source, content }, anchor, { signal: new AbortController().signal, progress: () => undefined });
    stage.previousRevision = source.revision;
    stage.connection = { url: subscription.url, autoSync: subscription.autoSync, fetchedAt: Date.now() };
    stage.syncAttempt = now;
    stage.syncOwnOnly = !sourceId;
    await publishStages([stage]);
    return { status: 'success', summary: changeSummary(stage), revision: stage.revision };
  } catch (error) {
    if (stage) await discardStages([stage]);
    await recordSyncError(subscription, now, error);
    return { status: 'failed' };
  }
}
async function recordSyncError(subscription: SyncStatus, attempt: number, error: unknown): Promise<void> {
  const detail = error instanceof Error ? error.message.replace(/(?:https?|webcal):\/\/\S+/gi, '[naptárlink]').slice(0, 300) : '';
  await write(async db => {
    await db.runAsync('UPDATE source_sync SET lastError=? WHERE sourceId=? AND url=? AND lastAttempt=?',
      `${detail ? `${detail} ` : ''}Nem sikerült frissíteni. A korábbi órarend megmaradt; új próbálkozás a következő frissítési időpontban.`, subscription.sourceId, subscription.url, attempt);
  });
}
export async function disconnectCalendar(sourceId: string): Promise<void> {
  await write(async db => { await db.runAsync("UPDATE source_sync SET url=NULL,autoSync=0,lastError='' WHERE sourceId=?", sourceId); });
}

/** An unchanged feed only updates its successful check time, without rebuilding events. */
async function recordUnchanged(subscription: SyncStatus, revision: string, attempt: number, ownOnly: boolean): Promise<SyncResult> {
  return transaction(async db => {
    const current = await db.getFirstAsync<{ revision: string; url: string; lastAttempt: number; isOwn: number }>(`SELECT s.revision,c.url,c.lastAttempt,p.isOwn FROM sources s JOIN source_sync c ON c.sourceId=s.id JOIN profiles p ON p.id=s.profileId WHERE s.id=?`, subscription.sourceId);
    if (!current || current.revision !== revision || current.url !== subscription.url || current.lastAttempt !== attempt || (ownOnly && !current.isOwn)) return { status: 'skipped' };
    await db.runAsync("UPDATE source_sync SET lastSuccess=?,lastError='',lastChange='' WHERE sourceId=?", Date.now(), subscription.sourceId);
    return { status: 'success', summary: '', revision };
  });
}
