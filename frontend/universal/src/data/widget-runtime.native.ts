import { profiles, visibleEvents } from './repository';
import { today } from '../domain/time';
import { widgetData } from '../domain/widget';
import { publishWidget } from '../widgets/publish';

let generation = 0;
let pending: Promise<void> = Promise.resolve();
let fingerprint = '';
function isOwn(profile: { isOwn: number }) { return Boolean(profile.isOwn); }
export function reconcileWidgets(): Promise<void> {
  const requested = generation;
  const next = pending.then(async () => {
    if (requested !== generation) return;
    const own = (await profiles()).find(isOwn);
    const events = own ? await visibleEvents(own.id, today(), 8, false) : [];
    const data = widgetData(events, Date.now());
    const nextFingerprint = JSON.stringify(data.days);
    if (requested === generation && fingerprint !== nextFingerprint) {
      await publishWidget(data);
      fingerprint = nextFingerprint;
    }
  });
  pending = next.catch(() => undefined);
  return next;
}
/** Invalidate queued writes before removing the signed-out account's snapshot. */
export async function clearWidgets(): Promise<void> {
  generation += 1;
  fingerprint = '';
  await pending;
  await publishWidget({ updated: Date.now(), days: [] });
}
