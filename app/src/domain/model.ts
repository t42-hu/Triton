export type EventKind = 'timed' | 'allDay';
export type Week = 'A' | 'B';
export type Anchor = { date: string; week: Week };
export type DateRange = { from: string; to: string };
export type Recurrence = { frequency: 'weekly'; weeks: 'all' | Week; until: string };
export type CalendarEvent = {
  id: string; title: string; kind: EventKind; start: string; end: string;
  location?: string; recurrence?: Recurrence;
};
export type Occurrence = {
  key: string; title: string; originalTitle: string; start: number; end: number;
  location: string; kind: EventKind;
};
export type EventPatch = Partial<Pick<Occurrence, 'title' | 'start' | 'end' | 'location'>> & { hidden?: boolean };
export type DisplayEvent = Occurrence & {
  sourceId: string; profileId: number; hidden: number; base: string; patch: string | null;
};
export type Profile = { id: number; name: string; isOwn: number };
export type Source = {
  id: string; profileId: number; format: 'ics' | 'json'; content: string;
  name: string; revision: string; fromDate: string; toDate: string; isManual: number;
};
export type ImportControl = { signal: AbortSignal; progress: (count: number) => void };
