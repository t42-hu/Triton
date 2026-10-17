import type { RemoteRecord, RemoteRow } from './workspace-types';
type Request = <T>(path: string, method?: string, body?: unknown) => Promise<T>;
type Page = { items: { resource: string; record: RemoteRow }[]; snapshotToken: string; highSequence: string; nextOffset: number | null };
type Pull = { requiresSnapshot: boolean; changes: unknown[]; nextSequence: string; hasMore: boolean };
/** Reuse a complete snapshot only after the server confirms no visible changes or access revocations. */
export function createWorkspaceSnapshotReader(request: Request) {
  let cached: { deviceId: string; sequence: string; records: RemoteRecord[] } | undefined;
  return async function snapshot(deviceId: string): Promise<RemoteRecord[]> {
    if (cached?.deviceId === deviceId) {
      const query = new URLSearchParams({ deviceId, after: cached.sequence, limit: '500' });
      const pull = await request<Pull>(`/sync/pull?${query}`);
      if (!pull.requiresSnapshot && !pull.changes.length && !pull.hasMore) {
        await request('/sync/ack', 'POST', { deviceId, sequence: pull.nextSequence });
        cached.sequence = pull.nextSequence;
        return cached.records;
      }
    }
    // Never return a prior account or partial snapshot if a refresh fails.
    cached = undefined;
    const records: RemoteRecord[] = [];
    let token: string | undefined; let offset = 0; let sequence = '0';
    do {
      const query = new URLSearchParams({ deviceId, limit: '200', ...(token ? { snapshotToken: token, offset: String(offset) } : {}) });
      const page = await request<Page>(`/sync/snapshot?${query}`);
      token = page.snapshotToken; sequence = page.highSequence;
      records.push(...page.items.map(item => ({ resource: item.resource, id: item.record.id, version: item.record.version, data: item.record })));
      if (page.nextOffset === null) break;
      offset = page.nextOffset;
    } while (true);
    await request('/sync/ack', 'POST', { deviceId, sequence, snapshotToken: token });
    cached = { deviceId, sequence, records };
    return records;
  };
}
