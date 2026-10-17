import { backend } from './backend';
import { synchronizeWorkspace } from './workspace-sync';
import { getDatabase } from './database';
import type { SyncResult } from './calendar-sync';
let refreshing: Promise<SyncResult> | null = null;
/** The server owns imported event data; clients only request a check and pull the result. */
export function refreshServerCalendars(): Promise<SyncResult> {
  if (refreshing) return refreshing;
  refreshing = check().finally(() => { refreshing = null; });
  return refreshing;
}
type Revision = { sourceId: string; revision: string; lastChange: string };
async function revisions(): Promise<Revision[]> {
  return (await getDatabase()).getAllAsync<Revision>('SELECT s.id AS sourceId,s.revision,c.lastChange FROM sources s JOIN source_sync c ON c.sourceId=s.id WHERE c.url IS NOT NULL');
}
async function check(): Promise<SyncResult> {
  const previous = await revisions();
  await synchronizeWorkspace();
  if (!(await revisions()).length) return { status: 'skipped' };
  const result = await backend<SyncResult>('/calendar-subscriptions/refresh', 'POST');
  await synchronizeWorkspace();
  const priorVersions = new Map(previous.map(row => [row.sourceId, row.revision]));
  const changed = (await revisions()).filter(row => priorVersions.has(row.sourceId) && priorVersions.get(row.sourceId) !== row.revision);
  return { ...result, summary: changed.map(row => row.lastChange).filter(Boolean).join(' '), revision: changed.map(row => row.revision).join('-') };
}
