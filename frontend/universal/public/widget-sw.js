/* This worker never intercepts requests or caches pages, credentials or API responses. */
const tag = 'triton-today';
const cacheName = 'triton-widget-v1';
const snapshotUrl = new URL('/widgets/local-snapshot', self.location.origin).href;
let writes = Promise.resolve();
self.addEventListener('install', event => event.waitUntil(self.skipWaiting()));
self.addEventListener('activate', event => event.waitUntil(self.clients.claim()));
self.addEventListener('message', event => {
  if (event.data?.type !== 'triton-widget' || !self.widgets || !event.source?.url || new URL(event.source.url).origin !== self.location.origin) return;
  const snapshot = event.data.data;
  writes = writes.catch(() => undefined).then(async () => {
    const cache = await caches.open(cacheName);
    if (!snapshot.days?.length) await cache.delete(snapshotUrl);
    else await cache.put(snapshotUrl, new Response(JSON.stringify(snapshot), { headers: { 'Content-Type': 'application/json' } }));
    await renderWidget();
  });
  event.waitUntil(writes);
});
self.addEventListener('widgetinstall', event => event.waitUntil(installWidget()));
self.addEventListener('widgetresume', event => event.waitUntil(renderWidget()));
self.addEventListener('widgetclick', event => event.waitUntil(renderWidget()));
self.addEventListener('widgetuninstall', event => {
  if (event.widget.instances.length <= 1) event.waitUntil(uninstallWidget());
});
self.addEventListener('periodicsync', event => {
  if (event.tag === tag) event.waitUntil(renderWidget());
});
async function installWidget() {
  if (self.registration.periodicSync) {
    try { await self.registration.periodicSync.register(tag, { minInterval: 900000 }); } catch { /* OS may deny periodic sync. Resume and app updates still work. */ }
  }
  await renderWidget();
  const clients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
  clients.forEach(client => client.postMessage({ type: 'triton-widget-refresh' }));
}
async function uninstallWidget() {
  await self.registration.periodicSync?.unregister(tag);
  await caches.delete(cacheName);
}
async function renderWidget() {
  if (!self.widgets || !await self.widgets.getByTag(tag)) return;
  const cache = await caches.open(cacheName);
  const response = await cache.match(snapshotUrl);
  const snapshot = response ? await response.json() : { days: [] };
  const now = Date.now();
  const day = snapshot.days.find(item => now >= item.start && now < item.end);
  const events = day?.events.filter(event => event.allDay || event.end > now || event.start === event.end && event.start >= now) ?? [];
  const time = new Intl.DateTimeFormat('hu-HU', { timeZone: 'Europe/Budapest', hour: '2-digit', minute: '2-digit' }).format(now);
  const data = { url: self.location.origin, label: day?.label ?? 'Mai nap', clock: `Most · ${time}`, events: events.slice(0, 5), message: !day ? 'Nyisd meg a Triton42-t' : events.length ? '' : 'Ma nincs több esemény', more: events.length > 5 ? `+${events.length - 5} esemény ma` : '' };
  const template = await (await fetch('/triton/widgets/today.json')).text();
  await self.widgets.updateByTag(tag, { template, data: JSON.stringify(data) });
}
