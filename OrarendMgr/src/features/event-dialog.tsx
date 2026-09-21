import { useState } from 'react';
import { FlatList, View } from 'react-native';
import { Text } from '@/components/ui/text';
import type { DisplayEvent, EventPatch } from '../domain/model';
import { fromWall, wallTime } from '../domain/time';
import { patchForTarget } from '../domain/comparison';
import { futureEvents, updateEvents, deleteManualSource } from '../data/repository';
import { Action, Confirm, Field, Modal, Toggle } from './controls';
import { useApp } from './app-state';

export function EventDialog({ event, close }: { event: DisplayEvent; close: () => void }) {
  const app = useApp();
  const [title, setTitle] = useState(event.title);
  const [location, setLocation] = useState(event.location);
  const [start, setStart] = useState(wallTime(event.start).slice(0, 16));
  const [end, setEnd] = useState(wallTime(event.end).slice(0, 16));
  const [hidden, setHidden] = useState(Boolean(event.hidden));
  const [candidates, setCandidates] = useState<DisplayEvent[]>([]);
  const [selected, setSelected] = useState(new Set<string>());
  const [error, setError] = useState('');
  const [deleting, setDeleting] = useState(false);
  async function save(reset = false) {
    try {
      const changes = candidates.length ? candidates.filter(item => selected.has(item.sourceId + item.key)).map(item => ({ event: item, patch: patchForTarget(createPatch(event, { title, location, start, end, hidden }, true), item) })) : [{ event, patch: reset ? null : createPatch(event, { title, location, start, end, hidden }, false) }];
      await updateEvents(changes); await app.refresh(); close();
    } catch (error) { setError(String(error)); }
  }
  async function suggest() {
    const items = await futureEvents(event); setCandidates(items); setSelected(new Set(items.map(item => item.sourceId + item.key)));
  }
  async function remove() { try { await deleteManualSource(event.sourceId); await app.refresh(); close(); } catch (error) { setError(String(error)); } }
  return <Modal title="Óra részletei" description={`${event.kind === 'allDay' ? 'Egész napos esemény' : 'Budapesti idő'} · Terem: ${event.location || 'nincs megadva'}`} close={close}>
    <Field label="Óra neve" value={title} onChange={setTitle} /><Field label="Terem" value={location} onChange={setLocation} />
    <Field label="Kezdés" value={start} onChange={setStart} /><Field label="Befejezés" value={end} onChange={setEnd} />
    <Toggle label="Alkalom elrejtése / kihagyása" checked={hidden} onChange={setHidden} />
    <Action secondary onPress={() => void suggest().catch(error => setError(String(error)))}>Tartós módosítás: alkalmak kiválasztása</Action>
    {candidates.length ? <CandidateList items={candidates} selected={selected} setSelected={setSelected} /> : null}
    {error ? <Text accessibilityRole="alert" className="text-destructive">{error}</Text> : null}
    <Action disabled={candidates.length > 0 && !selected.size} onPress={() => void save()}>Módosítás jóváhagyása</Action>
    {event.patch && !candidates.length ? <Action secondary onPress={() => void save(true)}>Eredeti adatok visszaállítása</Action> : null}
    {event.sourceId.includes(':manual:') ? <Action secondary onPress={() => setDeleting(true)}>Kézi sorozat törlése</Action> : null}
    {deleting ? <Confirm title="Kézi sorozat törlése" description="A kézzel létrehozott esemény összes alkalma végleg törlődik. Egyetlen alkalom kihagyásához használd az elrejtést." accept={() => void remove()} cancel={() => setDeleting(false)} /> : null}
  </Modal>;
}
function CandidateList({ items, selected, setSelected }: { items: DisplayEvent[]; selected: Set<string>; setSelected: (value: Set<string>) => void }) {
  function toggle(item: DisplayEvent) {
    const next = new Set(selected); const key = item.sourceId + item.key;
    if (next.has(key)) next.delete(key); else next.add(key);
    setSelected(next);
  }
  return <View className="gap-2"><Text>{selected.size} kijelölt alkalom. A meglévő felülírásokat az új érték felváltja.</Text>
    <FlatList style={{ height: 180 }} data={items} keyExtractor={item => item.sourceId + item.key} renderItem={({ item }) => <Toggle label={`${wallTime(item.start).slice(0, 16)} ${item.patch ? '(módosítva)' : ''}`} checked={selected.has(item.sourceId + item.key)} onChange={() => toggle(item)} />} />
  </View>;
}

function createPatch(event: DisplayEvent, fields: { title: string; location: string; start: string; end: string; hidden: boolean }, bulk: boolean): EventPatch {
    const { title, location, start, end, hidden } = fields;
    if (bulk && (start.slice(0, 10) !== wallTime(event.start).slice(0, 10) || end.slice(0, 10) !== wallTime(event.end).slice(0, 10))) throw new Error('Dátum csak egyetlen alkalomnál módosítható.');
    if (event.kind === 'allDay' && (!start.endsWith('T00:00') || !end.endsWith('T00:00'))) throw new Error('Egész napos esemény határa éjfél legyen.');
    const value: EventPatch = {};
    if (title !== event.title) value.title = title;
    if (location !== event.location) value.location = location;
    if (start !== wallTime(event.start).slice(0, 16)) value.start = fromWall(start);
    if (end !== wallTime(event.end).slice(0, 16)) value.end = fromWall(end);
    if (hidden !== Boolean(event.hidden)) value.hidden = hidden;
    return value;
  }
