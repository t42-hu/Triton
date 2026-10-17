import { profiles, visibleEvents } from './repository';
import { today } from '../domain/time';
import { widgetData, type WidgetData } from '../domain/widget';

let generation = 0;
let worker: Promise<ServiceWorkerRegistration> | undefined;
if (typeof navigator !== 'undefined' && 'serviceWorker' in navigator) navigator.serviceWorker.addEventListener('message', event => {
  if (event.data?.type === 'triton-widget-refresh') void reconcileWidgets().catch(ignoreRefreshError);
});
function ignoreRefreshError() { /* The next app write retries the widget update. */ }
async function publish(data: WidgetData, requested: number): Promise<void> {
  if (!('serviceWorker' in navigator)) return;
  worker ??= navigator.serviceWorker.register('/widget-sw.js').catch(error => { worker = undefined; throw error; });
  const registration = await worker;
  const active = registration.active ?? await activated(registration);
  if (requested === generation) active.postMessage({ type: 'triton-widget', data });
}
function activated(registration: ServiceWorkerRegistration): Promise<ServiceWorker> {
  return new Promise((resolve, reject) => {
    const candidate = registration.installing ?? registration.waiting;
    if (!candidate) { reject(new Error('A widget szolgáltatása nem indult el.')); return; }
    function changed() {
      if (candidate?.state === 'activated') { candidate.removeEventListener('statechange', changed); resolve(candidate); }
      if (candidate?.state === 'redundant') { candidate.removeEventListener('statechange', changed); reject(new Error('A widget szolgáltatása nem indult el.')); }
    }
    candidate.addEventListener('statechange', changed); changed();
  });
}
export async function reconcileWidgets(): Promise<void> {
  const requested = generation;
  const own = (await profiles()).find(profile => profile.isOwn);
  await publish(widgetData(own ? await visibleEvents(own.id, today(), 8, false) : [], Date.now()), requested);
}
export async function clearWidgets(): Promise<void> { generation += 1; await publish({ updated: Date.now(), days: [] }, generation); }
