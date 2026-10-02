import { useState } from 'react';
import { View } from 'react-native';
import { BookOpen, CalendarClock, Repeat2, Save } from 'lucide-react-native';
import { Text } from '@/components/ui/text';
import { Icon } from '@/components/ui/icon';
import { Action, Choice, Field, Modal, Toggle } from './controls';
import { useApp } from './app-state';
import { uniqueId } from '../data/importer';
import { createManualEvent } from '../data/manual-event';
import { addDays, fromWall, today, validDate, wallTime } from '../domain/time';
import type { CalendarEvent, DisplayEvent, EventCategory, Recurrence } from '../domain/model';
import { EVENT_CATEGORIES } from '../domain/student';
import { openProfile } from './view-state';
import { RoomField } from './room-map-dialog';
import { DateField, DateTimeField } from './date-time-field';
import { EventNotesField } from './event-notes-field';
import { useEventTimes } from './use-event-times';
import { ReminderDialog } from './reminder-dialog';
import { eventCategoryIcon, eventCategoryName } from './event-presentation';

type Draft = { profileId: number; title: string; location: string; notes: string; category: EventCategory; weeks: string; until: string; kind: string; reminder: boolean };

/** Creates lessons, assessments and personal events through the same calendar flow. */
export function ManualDialog({ profileId, close, openMap, initialCategory = 'lesson' }: { profileId: number; close: () => void; openMap: (location: string, onClose: () => void) => void; initialCategory?: EventCategory }) {
  const app = useApp(); const [draft, setDraft] = useState<Draft>({ profileId, title: '', location: '', notes: '', category: initialCategory, weeks: 'once', until: addDays(today(), 180), kind: initialCategory === 'assignment' ? 'allDay' : 'timed', reminder: false });
  const [now] = useState(Date.now);
  const times = useEventTimes(initialCategory === 'assignment' ? `${today()}T00:00` : wallTime(now + 3600000).slice(0, 16), initialCategory === 'assignment' ? `${addDays(today(), 1)}T00:00` : wallTime(now + 9000000).slice(0, 16));
  const [error, setError] = useState(''); const [busy, setBusy] = useState(false); const [mapOpen, setMapOpen] = useState(false); const [created, setCreated] = useState<DisplayEvent>();
  function change(patch: Partial<Draft>) { setDraft(current => ({ ...current, ...patch })); }
  async function save() {
    if (busy) return;
    setBusy(true); setError('');
    try {
      const event = await createManualEvent(draft.profileId, buildEvent(draft, times.start, times.end), app.anchor);
      setCreated(event); await app.refresh(); app.setView(current => openProfile(current, draft.profileId));
      if (!draft.reminder) close();
    } catch (reason) { setError(String(reason)); } finally { setBusy(false); }
  }
  if (created) return <ReminderDialog event={created} close={close} />;
  if (mapOpen) return null;
  return <Modal title="Új óra vagy esemény" description="Óra, személyes program vagy tanulmányi határidő." close={close}>
    <Choice fullWidth icon={eventCategoryIcon(draft.category)} label="Mit szeretnél hozzáadni?" value={draft.category} options={EVENT_CATEGORIES} onChange={category => change({ category: category as EventCategory })} />
    <ManualDetails draft={draft} change={change} openMap={() => { setMapOpen(true); openMap(draft.location, () => setMapOpen(false)); }} />
    <ManualSchedule kind={draft.kind} setKind={kind => change({ kind })} start={times.start} setStart={value => times.changeStart(value, draft.kind === 'allDay')} end={times.end} setEnd={times.setEnd} />
    <ManualSection icon={Repeat2} title="Ismétlődés"><Choice fullWidth label="Ismétlődés" value={draft.weeks} onChange={weeks => change({ weeks })} options={[{ value: 'once', label: 'Egyszeri' }, { value: 'all', label: 'Minden héten' }, { value: 'A', label: 'A héten' }, { value: 'B', label: 'B héten' }]} />{draft.weeks !== 'once' ? <DateField label="Ismétlődés vége" value={draft.until} onChange={until => change({ until })} /> : null}</ManualSection>
    <Toggle label="Emlékeztető beállítása mentés után" checked={draft.reminder} onChange={reminder => change({ reminder })} />
    {error ? <Text accessibilityRole="alert" className="text-destructive">{error}</Text> : null}
    <Action icon={Save} disabled={busy || !draft.title.trim()} onPress={() => void save()}>{busy ? 'Mentés…' : `${eventCategoryName(draft.category)} mentése`}</Action>
  </Modal>;
}

function buildEvent(draft: Draft, start: string, end: string): CalendarEvent {
  const allDay = draft.kind === 'allDay';
  const event: CalendarEvent = { id: uniqueId(), title: draft.title, location: draft.location, notes: draft.notes, category: draft.category, kind: allDay ? 'allDay' : 'timed', start: allDay ? start.slice(0, 10) : new Date(fromWall(start)).toISOString(), end: allDay ? end.slice(0, 10) : new Date(fromWall(end)).toISOString() };
  if (draft.weeks !== 'once') event.recurrence = { frequency: 'weekly', weeks: draft.weeks as Recurrence['weeks'], until: draft.until };
  return event;
}

function ManualDetails({ draft, change, openMap }: { draft: Draft; change: (patch: Partial<Draft>) => void; openMap: () => void }) {
  const app = useApp();
  return <ManualSection icon={eventCategoryIcon(draft.category)} title={`${eventCategoryName(draft.category)} adatai`}>
    <Choice fullWidth label="Célprofil" value={String(draft.profileId)} onChange={id => change({ profileId: Number(id) })} options={app.profileList.map(profile => ({ value: String(profile.id), label: profile.name }))} />
    <Field label={`${eventCategoryName(draft.category)} neve`} value={draft.title} onChange={title => change({ title })} />
    <RoomField allowMap={draft.category === 'lesson'} value={draft.location} onChange={location => change({ location })} onOpen={openMap} />
    <EventNotesField value={draft.notes} onChange={notes => change({ notes })} />
  </ManualSection>;
}

function ManualSection({ icon, title, children }: { icon: typeof BookOpen; title: string; children: React.ReactNode }) {
  return <View className="gap-3 rounded-xl border border-border bg-background/40 p-4"><View className="flex-row items-center gap-2"><Icon as={icon} size={18} className="text-primary" /><Text className="font-semibold">{title}</Text></View>{children}</View>;
}

function ManualSchedule({ kind, setKind, start, setStart, end, setEnd }: { kind: string; setKind: (value: string) => void; start: string; setStart: (value: string) => void; end: string; setEnd: (value: string) => void }) {
  function changeKind(value: string) {
    setKind(value);
    if (value === 'allDay' && validDate(start.slice(0, 10)) && end.slice(0, 10) <= start.slice(0, 10)) setEnd(`${addDays(start.slice(0, 10), 1)}T00:00`);
  }
  return <ManualSection icon={CalendarClock} title="Időpont">
    <Choice fullWidth label="Időpont típusa" value={kind} onChange={changeKind} options={[{ value: 'timed', label: 'Időzített' }, { value: 'allDay', label: 'Egész napos' }]} />
    <View className="gap-3"><DateTimeField label="Kezdés" value={start} onChange={setStart} allDay={kind === 'allDay'} /><DateTimeField label="Befejezés" value={end} onChange={setEnd} allDay={kind === 'allDay'} /></View>
    {kind === 'allDay' ? <Text className="text-xs text-muted-foreground">A végdátum már nem része az eseménynek.</Text> : null}
  </ManualSection>;
}
