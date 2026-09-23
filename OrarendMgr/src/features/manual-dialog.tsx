import { useState } from 'react';
import { Text } from '@/components/ui/text';
import { Action, Choice, Field, Modal } from './controls';
import { useApp } from './app-state';
import { discardStages, publishStages, stageSource, uniqueId } from '../data/importer';
import { addDays, fromWall, today } from '../domain/time';
import type { CalendarEvent, Recurrence } from '../domain/model';

export function ManualDialog({ profileId, close }: { profileId: number; close: () => void }) {
  const app = useApp();
  const [selectedId, setSelectedId] = useState(profileId);
  const [title, setTitle] = useState('');
  const [location, setLocation] = useState('');
  const [start, setStart] = useState(`${today()}T08:00`);
  const [end, setEnd] = useState(`${today()}T09:30`);
  const [weeks, setWeeks] = useState('once');
  const [until, setUntil] = useState(addDays(today(), 180));
  const [kind, setKind] = useState('timed');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  async function save() {
    setBusy(true); setError('');
    try {
      const event: CalendarEvent = { id: uniqueId(), title, location, kind: kind === 'allDay' ? 'allDay' : 'timed', start: kind === 'allDay' ? start.slice(0, 10) : new Date(fromWall(start)).toISOString(), end: kind === 'allDay' ? end.slice(0, 10) : new Date(fromWall(end)).toISOString() };
      if (weeks !== 'once') event.recurrence = { frequency: 'weekly', weeks: weeks as Recurrence['weeks'], until };
      const stage = await stageSource({ id: `${selectedId}:manual:${event.id}`, profileId: selectedId, format: 'json', content: JSON.stringify({ version: 1, events: [event] }), name: title, fromDate: start.slice(0, 10), toDate: weeks === 'once' ? end.slice(0, 10) : until, isManual: 1 }, app.anchor, { signal: new AbortController().signal, progress: () => undefined });
      try { await publishStages([stage]); } finally { await discardStages([stage]); }
      await app.refresh();
      if (selectedId !== app.view.left) app.setView(current => current.openProfiles.includes(selectedId) ? {} : { openProfiles: [...current.openProfiles, selectedId], right: selectedId, compare: true });
      close();
    } catch (error) { setError(String(error)); } finally { setBusy(false); }
  }
  return <Modal title="Új óra" description="Az időpontokat budapesti időben add meg. Egész napos eseménynél a végdátum már nem része az eseménynek." close={close}>
    <Choice label="Célprofil" value={String(selectedId)} onChange={id => setSelectedId(Number(id))} options={app.profileList.map(profile => ({ value: String(profile.id), label: profile.name }))} />
    <Field label="Óra neve" value={title} onChange={setTitle} /><Field label="Terem" value={location} onChange={setLocation} />
    <Choice label="Esemény típusa" value={kind} onChange={setKind} options={[{ value: 'timed', label: 'Időzített' }, { value: 'allDay', label: 'Egész napos' }]} />
    <Field label="Kezdés (ÉÉÉÉ-HH-NNTóó:pp)" value={start} onChange={setStart} /><Field label="Befejezés (ÉÉÉÉ-HH-NNTóó:pp)" value={end} onChange={setEnd} />
    <Choice label="Ismétlődés" value={weeks} onChange={setWeeks} options={[{ value: 'once', label: 'Egyszeri' }, { value: 'all', label: 'Minden héten' }, { value: 'A', label: 'A héten' }, { value: 'B', label: 'B héten' }]} />
    {weeks !== 'once' ? <Field label="Ismétlődés vége" value={until} onChange={setUntil} /> : null}
    {error ? <Text accessibilityRole="alert" className="text-destructive">{error}</Text> : null}<Action disabled={busy} onPress={() => void save()}>Óra mentése</Action>
  </Modal>;
}
