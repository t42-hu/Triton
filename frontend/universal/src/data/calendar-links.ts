import { backend } from './backend';
import type { EventCategory } from '../domain/model';

export type ShareSelection = { sourceIds: string[]; includeManual: boolean; categories: EventCategory[] };
export type ShareSource = { id: string; name: string; type: 'ics' | 'json' | 'link' | 'manual'; eventCount: number };
export type ShareOptions = { calendarId: string; name: string; sources: ShareSource[] };
export type CalendarShare = { id: string; calendarId: string; name: string; url: string | null; createdAt: string; revokedAt: string | null; selection: ShareSelection | null; available: boolean };
export { importedCalendars, removeImportedCalendar, type ImportedCalendar } from './imported-calendar-links';
export function calendarShares(): Promise<CalendarShare[]> { return backend('/calendar-share'); }
export function calendarShareOptions(): Promise<ShareOptions[]> { return backend('/calendar-share/options'); }
export function createCalendarShare(calendarId: string, selection: ShareSelection): Promise<CalendarShare> {
  return backend('/calendar-share', 'POST', { calendarId, selection });
}
export function revokeCalendarShare(id: string): Promise<{ revoked: true }> { return backend(`/calendar-share/${encodeURIComponent(id)}`, 'DELETE'); }
