import type { SyncResult } from './calendar-sync';
import { refreshServerCalendars } from './calendar-server-sync';

/** Foreground refresh is shared; browsers do not schedule background tasks. */
export async function refreshCalendar(): Promise<SyncResult> { return refreshServerCalendars(); }
export async function configureBackground(): Promise<string> { return 'A naptárlinkeket a szerver 15 percenként ellenőrzi, bezárt alkalmazás mellett is.'; }
export async function enableNotifications(enabled: boolean): Promise<void> {
  if (enabled) throw new Error('Változásértesítés a mobilalkalmazásban érhető el.');
}
