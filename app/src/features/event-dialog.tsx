import { ReminderDialog } from './reminder-dialog';
import { NotebookPen, Bell, Repeat2, Save, RotateCcw, Trash2 } from 'lucide-react-native';
import { EVENT_CATEGORIES, categoryLabel } from '../domain/student';
import { LessonTasks } from './lesson-tasks';
import { NotebookDialog } from './notebook-dialog';
import { useState } from 'react';
import { ScrollView, View } from 'react-native';
import { Text } from '@/components/ui/text';
import type { DisplayEvent, EventCategory, EventPatch } from '../domain/model';
import { fromWall, wallTime } from '../domain/time';
import { eventIdentity, patchForTarget } from '../domain/comparison';
import { futureEvents, updateEvents, deleteManualSource } from '../data/repository';
import { Action, Choice, Confirm, Field, Modal, Toggle } from './controls';
import { useApp } from './app-state';
import { RoomField } from './room-map-dialog';
import { DateTimeField } from './date-time-field';
import { EventNotesField } from './event-notes-field';
import { useEventTimes } from './use-event-times';
import { eventCategoryIcon, eventCategoryName } from './event-presentation';

export function EventDialog({ event, close, openMap }: { event: DisplayEvent; close: () => void; openMap: (location: string, onClose: () => void) => void }) {
  const app = useApp(); const editor = useEventEditor(event);
  const [remindersOpen, setRemindersOpen] = useState(false); const [mapOpen, setMapOpen] = useState(false); const [deleting, setDeleting] = useState(false);
  const [notebookOpen, setNotebookOpen] = useState(false);
  async function save(reset = false) {
    try {
      const changes = editor.candidates.length ? editor.candidates.filter(item => editor.selected.has(eventIdentity(item))).map(item => ({ event: item, patch: patchForTarget(createPatch(event, editor.fields, true), item) })) : [{ event, patch: reset ? null : createPatch(event, editor.fields, false) }];
      await updateEvents(changes); await app.refresh(); close();
    } catch (error) { editor.setError(String(error)); }
  }
  async function suggest() { try { const items = await futureEvents(event); editor.setCandidates(items); editor.setSelected(new Set(items.map(eventIdentity))); } catch (error) { editor.setError(String(error)); } }
  async function remove() { try { await deleteManualSource(event.sourceId); await app.refresh(); close(); } catch (error) { editor.setError(String(error)); } }
  if (remindersOpen) return <ReminderDialog event={event} close={() => setRemindersOpen(false)} />;
  if (notebookOpen) return <NotebookDialog event={event} close={() => setNotebookOpen(false)} />;
  if (mapOpen) return null;
  return <Modal title={`${eventCategoryName(editor.fields.category)} részletei`} description={`${categoryLabel(event.category)} · ${event.location || 'Nincs helyszín megadva'}`} close={close}>
    <View className="flex-row flex-wrap gap-2"><Action secondary icon={NotebookPen} onPress={() => setNotebookOpen(true)}>Jegyzetfüzet</Action><Action secondary icon={Bell} onPress={() => setRemindersOpen(true)}>Emlékeztető</Action></View>
    <Choice fullWidth icon={eventCategoryIcon(editor.fields.category)} label="Esemény kategóriája" value={editor.fields.category} options={EVENT_CATEGORIES} onChange={category => editor.change({ category: category as EventCategory })} />
    <Field label={`${eventCategoryName(editor.fields.category)} neve`} value={editor.fields.title} onChange={title => editor.change({ title })} />
    <RoomField allowMap={editor.fields.category === 'lesson'} value={editor.fields.location} onChange={location => editor.change({ location })} onOpen={() => { setMapOpen(true); openMap(editor.fields.location, () => setMapOpen(false)); }} />
    <EventNotesField value={editor.fields.notes} onChange={notes => editor.change({ notes })} />
    <DateTimeField label="Kezdés" value={editor.fields.start} onChange={value => editor.changeStart(value, event.kind === 'allDay')} allDay={event.kind === 'allDay'} /><DateTimeField label="Befejezés" value={editor.fields.end} onChange={editor.setEnd} allDay={event.kind === 'allDay'} />
    <Toggle label="Alkalom elrejtése / kihagyása" checked={editor.fields.hidden} onChange={hidden => editor.change({ hidden })} />
    <Action secondary icon={Repeat2} onPress={() => void suggest()}>Tartós módosítás: alkalmak kiválasztása</Action>
    {editor.candidates.length ? <CandidateList items={editor.candidates} selected={editor.selected} setSelected={editor.setSelected} /> : null}
    {editor.error ? <Text accessibilityRole="alert" className="text-destructive">{editor.error}</Text> : null}
    <Action icon={Save} disabled={editor.candidates.length > 0 && !editor.selected.size} onPress={() => void save()}>Módosítás jóváhagyása</Action>
    {event.patch && !editor.candidates.length ? <Action secondary icon={RotateCcw} onPress={() => void save(true)}>Eredeti adatok visszaállítása</Action> : null}
    <LessonTasks event={event} />
    {event.sourceId.includes(':manual:') ? <Action secondary icon={Trash2} onPress={() => setDeleting(true)}>Kézi sorozat törlése</Action> : null}
    {deleting ? <Confirm title="Kézi sorozat törlése" description="A kézzel létrehozott esemény összes alkalma és feladata törlődik." accept={() => void remove()} cancel={() => setDeleting(false)} /> : null}
  </Modal>;
}

type EventFields = { title: string; location: string; notes: string; start: string; end: string; hidden: boolean; category: EventCategory };
function useEventEditor(event: DisplayEvent) {
  const [draft, setDraft] = useState({ title: event.title, location: event.location, notes: event.notes ?? '', hidden: Boolean(event.hidden), category: event.category ?? 'lesson' });
  const times = useEventTimes(wallTime(event.start).slice(0, 16), wallTime(event.end).slice(0, 16));
  const [candidates, setCandidates] = useState<DisplayEvent[]>([]); const [selected, setSelected] = useState(new Set<string>()); const [error, setError] = useState('');
  function change(patch: Partial<typeof draft>) { setDraft(current => ({ ...current, ...patch })); }
  return { fields: { ...draft, start: times.start, end: times.end }, change, setEnd: times.setEnd, changeStart: times.changeStart, candidates, setCandidates, selected, setSelected, error, setError };
}
function CandidateList({ items, selected, setSelected }: { items: DisplayEvent[]; selected: Set<string>; setSelected: (value: Set<string>) => void }) {
  function toggle(item: DisplayEvent) {
    const next = new Set(selected); const key = eventIdentity(item);
    if (next.has(key)) next.delete(key); else next.add(key);
    setSelected(next);
  }
  return <View className="gap-2"><Text>{selected.size} kijelölt alkalom. A meglévő felülírásokat az új érték felváltja.</Text>
    <ScrollView nestedScrollEnabled keyboardDismissMode="none" keyboardShouldPersistTaps="handled" style={{ maxHeight: 180 }} contentContainerStyle={{ gap: 12 }}>{items.map(item => <Toggle key={eventIdentity(item)} label={`${wallTime(item.start).slice(0, 16).replace('T', ' ')} ${item.patch ? '(módosítva)' : ''}`} checked={selected.has(eventIdentity(item))} onChange={() => toggle(item)} />)}</ScrollView>
  </View>;
}

function createPatch(event: DisplayEvent, fields: EventFields, bulk: boolean): EventPatch {
    const { title, location, notes, start, end, hidden, category } = fields;
    if (bulk && (start.slice(0, 10) !== wallTime(event.start).slice(0, 10) || end.slice(0, 10) !== wallTime(event.end).slice(0, 10))) throw new Error('Dátum csak egyetlen alkalomnál módosítható.');
    if (event.kind === 'allDay' && (!start.endsWith('T00:00') || !end.endsWith('T00:00'))) throw new Error('Egész napos esemény határa éjfél legyen.');
    const value: EventPatch = {};
    if (title !== event.title) value.title = title;
    if (category !== (event.category ?? 'lesson')) value.category = category;
    if (location !== event.location) value.location = location;
    if (notes !== (event.notes ?? '')) value.notes = notes;
    if (start !== wallTime(event.start).slice(0, 16)) value.start = fromWall(start);
    if (end !== wallTime(event.end).slice(0, 16)) value.end = fromWall(end);
    if (hidden !== Boolean(event.hidden)) value.hidden = hidden;
    return value;
  }
