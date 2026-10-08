import type { Profile, Source, DisplayEvent, EventCategory, Occurrence } from '@/domain/model';
import type { LessonTask, NotebookLink } from '@/domain/student';
export type LocalWorkspace = {
  profiles: Profile[]; sources: Source[];
  events: (DisplayEvent & { revision: string; searchText: string })[];
  overrides: { sourceId: string; key: string; patch: string }[];
  source_sync: { sourceId: string; url: string | null; autoSync: number; importedAt: number; lastAttempt: number; lastSuccess: number; lastError: string; lastChange: string }[];
  event_reminders: { sourceId: string; key: string; excludeGlobal: number; rules: string }[];
  lesson_tasks: (LessonTask & { searchText: string })[]; notebook_links: (NotebookLink & { searchText: string })[];
  settings: { key: string; value: string }[];
};
export type CloudRecord = { resource: string; id: string; data: Record<string, unknown> };
export type IdentityMap = Record<string, string>;
/** Fields consumed from the authenticated domain API, after its resource schemas validate writes. */
export type RemoteRow = {
  [key: string]: unknown;
  id: string; version: number; name: string; isOwn: boolean; calendarId: string; profileId: string; sourceId: string;
  content: string | null; format: 'manual' | 'json' | 'ics'; coverageFrom: string | null; coverageTo: string | null;
  externalUid: string | null; title: string; kind: Occurrence['kind']; startDate: string; endDate: string; startsAt: string; endsAt: string;
  location: string; notes: string; category: EventCategory; eventId: string; occurrenceKey: string; hidden: boolean;
  url: string | null; autoSync: boolean; excludeGlobal: boolean; minutes: number; profile: 'gentle' | 'standard' | 'strong';
  completed: boolean; eventTitle: string; dueAt: string; subjectKey: string; subject: string;
  theme: 'system' | 'light' | 'dark'; calendarView: 'day' | 'week'; showWeekends: boolean; startHour: number; endHour: number;
  anchorDate: string; anchorWeek: 'A' | 'B'; deviceId: string; viewState: Record<string, unknown>; batteryPromptShownAt: string | null;
  enabled: boolean; presetId: string; position: number; color: string; scope: string; targetKey: string;
  greenColor: string; yellowColor: string; redColor: string; greenMinutes: number | null; yellowMinutes: number; redMinutes: number;
};
export type RemoteRecord = CloudRecord & { version: number };
