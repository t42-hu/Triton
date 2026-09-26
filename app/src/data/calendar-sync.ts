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
/** The persisted attempt timestamp enforces cooldown across foreground, background and restarts. */
async function claimSync(now: number): Promise<SyncStatus | null> {
  return transaction(async db => {
    const source = await db.getFirstAsync<SyncStatus>(`SELECT c.* FROM source_sync c JOIN sources s ON s.id=c.sourceId JOIN profiles p ON p.id=s.profileId WHERE p.isOwn=1 AND c.autoSync=1 AND c.url IS NOT NULL`);
    if (!source || now - source.lastAttempt < SYNC_INTERVAL) return null;
    await db.runAsync('UPDATE source_sync SET lastAttempt=? WHERE sourceId=?', now, source.sourceId);
    return source;
  });
}

/** A failed or stale refresh leaves the last published source and its overrides intact. */
export async function syncOwnCalendar(now = Date.now()): Promise<SyncResult> {
  const subscription = await claimSync(now);
  if (!subscription?.url) return { status: 'skipped' };
  let stage: StagedSource | undefined;
  try {
    const source = await sourceById(subscription.sourceId);
    if (!source) return { status: 'skipped' };
    const content = await fetchCalendar(subscription.url);
    const anchor = await readSetting<Anchor>('anchor', { date: monday(today()), week: 'A' });
    stage = await stageSource({ ...source, content }, anchor, { signal: new AbortController().signal, progress: () => undefined });
    stage.previousRevision = source.revision;
    stage.connection = { url: subscription.url, autoSync: 1, fetchedAt: Date.now() };
    stage.syncAttempt = now;
    await publishStages([stage]);
    return { status: 'success', summary: changeSummary(stage), revision: stage.revision };
  } catch {
    if (stage) await discardStages([stage]);
    await recordSyncError(subscription, now);
    return { status: 'failed' };
  }
}
async function recordSyncError(subscription: SyncStatus, attempt: number): Promise<void> {
  await write(async db => {
    await db.runAsync('UPDATE source_sync SET lastError=? WHERE sourceId=? AND url=? AND lastAttempt=?',
      'Nem sikerült frissíteni. A korábbi órarend megmaradt; új próbálkozás a következő frissítési időpontban.', subscription.sourceId, subscription.url, attempt);
  });
}
export async function disconnectCalendar(sourceId: string): Promise<void> {
  await write(async db => { await db.runAsync("UPDATE source_sync SET url=NULL,autoSync=0,lastError='' WHERE sourceId=?", sourceId); });
}
