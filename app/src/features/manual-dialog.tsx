import { useState } from 'react';
import { View, useWindowDimensions } from 'react-native';
import { BookOpen, CalendarClock, Check, Repeat2 } from 'lucide-react-native';
import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { Choice, Field, Modal } from './controls';
import { useApp } from './app-state';
import { discardStages, publishStages, stageSource, uniqueId } from '../data/importer';
import { addDays, fromWall, today } from '../domain/time';
import type { CalendarEvent, Recurrence } from '../domain/model';
import { openProfile } from './view-state';
import { RoomField, RoomMapDialog } from './room-map-dialog';

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
  const [mapOpen, setMapOpen] = useState(false);
  async function save() {
    setBusy(true); setError('');
    try {
      const event: CalendarEvent = { id: uniqueId(), title, location, kind: kind === 'allDay' ? 'allDay' : 'timed', start: kind === 'allDay' ? start.slice(0, 10) : new Date(fromWall(start)).toISOString(), end: kind === 'allDay' ? end.slice(0, 10) : new Date(fromWall(end)).toISOString() };
      if (weeks !== 'once') event.recurrence = { frequency: 'weekly', weeks: weeks as Recurrence['weeks'], until };
      const stage = await stageSource({ id: `${selectedId}:manual:${event.id}`, profileId: selectedId, format: 'json', content: JSON.stringify({ version: 1, events: [event] }), name: title, fromDate: start.slice(0, 10), toDate: weeks === 'once' ? end.slice(0, 10) : until, isManual: 1 }, app.anchor, { signal: new AbortController().signal, progress: () => undefined });
      try { await publishStages([stage]); } finally { await discardStages([stage]); }
      await app.refresh();
      app.setView(current => openProfile(current, selectedId));
      close();
    } catch (error) { setError(String(error)); } finally { setBusy(false); }
  }
  if (mapOpen) return <RoomMapDialog location={location} close={() => setMapOpen(false)} />;
  return <Modal title="Új óra" description="Add meg az óra adatait és időpontját." close={close}>
    <ManualSection icon={BookOpen} title="Óra adatai">
      <View className="gap-1.5"><Text className="text-sm font-medium">Célprofil</Text><Choice fullWidth label="Célprofil" value={String(selectedId)} onChange={id => setSelectedId(Number(id))} options={app.profileList.map(profile => ({ value: String(profile.id), label: profile.name }))} /></View>
      <Field label="Óra neve" value={title} onChange={setTitle} /><RoomField value={location} onChange={setLocation} onOpen={() => setMapOpen(true)} />
    </ManualSection>
    <ManualSchedule kind={kind} setKind={setKind} start={start} setStart={setStart} end={end} setEnd={setEnd} />
    <ManualSection icon={Repeat2} title="Ismétlődés">
      <Choice fullWidth label="Ismétlődés" value={weeks} onChange={setWeeks} options={[{ value: 'once', label: 'Egyszeri' }, { value: 'all', label: 'Minden héten' }, { value: 'A', label: 'A héten' }, { value: 'B', label: 'B héten' }]} />
      {weeks !== 'once' ? <Field label="Ismétlődés vége" value={until} onChange={setUntil} /> : null}
    </ManualSection>
    {error ? <Text accessibilityRole="alert" className="text-destructive">{error}</Text> : null}
    <Button accessibilityLabel="Óra mentése" disabled={busy} onPress={() => void save()}><Icon as={Check} size={17} className="text-primary-foreground" /><Text>{busy ? 'Mentés…' : 'Óra mentése'}</Text></Button>
  </Modal>;
}

function ManualSection({ icon, title, children }: { icon: typeof BookOpen; title: string; children: React.ReactNode }) {
  return <View className="gap-3 rounded-xl border border-border bg-background/40 p-4">
    <View className="flex-row items-center gap-2"><Icon as={icon} size={18} className="text-primary" /><Text className="font-semibold">{title}</Text></View>
    {children}
  </View>;
}

function ManualSchedule({ kind, setKind, start, setStart, end, setEnd }: { kind: string; setKind: (value: string) => void; start: string; setStart: (value: string) => void; end: string; setEnd: (value: string) => void }) {
  const compact = useWindowDimensions().width < 600;
  return <ManualSection icon={CalendarClock} title="Időpont">
    <Choice fullWidth label="Esemény típusa" value={kind} onChange={setKind} options={[{ value: 'timed', label: 'Időzített' }, { value: 'allDay', label: 'Egész napos' }]} />
    <View className={compact ? 'gap-3' : 'flex-row gap-3'}>
      <View className="min-w-0 flex-1"><Field label="Kezdés" value={start} onChange={setStart} /></View>
      <View className="min-w-0 flex-1"><Field label="Befejezés" value={end} onChange={setEnd} /></View>
    </View>
    <Text className="text-xs text-muted-foreground">Budapesti idő szerint. Egész napos óránál a végdátum nem része az eseménynek.</Text>
  </ManualSection>;
}
