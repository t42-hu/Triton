import type { SyncResult } from './calendar-sync';

/** Browsers only import on demand; they never schedule subscriptions or notifications. */
export async function refreshCalendar(): Promise<SyncResult> { return { status: 'skipped' }; }
export async function configureBackground(): Promise<string> { return 'Weben nincs automatikus frissítés.'; }
export async function enableNotifications(enabled: boolean): Promise<void> {
  if (enabled) throw new Error('Változásértesítés a mobilalkalmazásban érhető el.');
}
