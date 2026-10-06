import { useState } from 'react';
import { View } from 'react-native';
import { Search, Clock3 } from 'lucide-react-native';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { findCommonFreeTime, type FreeTimeResult } from '../data/free-time';
import { addDays, fromWall, today, wallTime } from '../domain/time';
import { useApp } from './app-state';
import { Action, Choice, Modal, Toggle } from './controls';
import { DateTimeField } from './date-time-field';

export function FreeTimeDialog({ profileId, close }: { profileId: number; close: () => void }) {
  const app = useApp(); const [selected, setSelected] = useState(() => new Set([profileId, ...app.view.openProfiles]));
  const [start, setStart] = useState(`${today()}T08:00`); const [end, setEnd] = useState(`${addDays(today(), 7)}T20:00`); const [duration, setDuration] = useState('30');
  const [result, setResult] = useState<FreeTimeResult>(); const [error, setError] = useState(''); const [busy, setBusy] = useState(false);
  function toggle(id: number) { setSelected(current => { const next = new Set(current); if (next.has(id)) next.delete(id); else next.add(id); return next; }); setResult(undefined); }
  async function search() {
    if (busy) return;
    setBusy(true); setError(''); setResult(undefined);
    try { setResult(await findCommonFreeTime([...selected], fromWall(start), fromWall(end), Number(duration))); }
    catch (reason) { setError(reason instanceof Error ? reason.message : String(reason)); } finally { setBusy(false); }
  }
  return <Modal title="Közös szabad idő" close={close}>
    <Text className="font-semibold">Résztvevők</Text>{app.profileList.map(profile => <Toggle key={profile.id} label={profile.name} checked={selected.has(profile.id)} onChange={() => toggle(profile.id)} />)}
    <DateTimeField label="Kezdés" value={start} onChange={value => { setStart(value); setResult(undefined); }} />
    <DateTimeField label="Befejezés" value={end} onChange={value => { setEnd(value); setResult(undefined); }} />
    <Choice fullWidth icon={Clock3} label="Minimum időtartam" value={duration} onChange={value => { setDuration(value); setResult(undefined); }} options={[{ value: '30', label: '30 perc' }, { value: '60', label: '1 óra' }, { value: '90', label: '1,5 óra' }, { value: '120', label: '2 óra' }]} />
    <Action icon={Search} disabled={busy || selected.size < 2} onPress={() => void search()}>{busy ? 'Keresés…' : 'Szabad idő keresése'}</Action>
    {selected.size < 2 ? <Text className="text-sm text-muted-foreground">Válassz legalább két profilt. Másik órarendet a Profilok menüben importálhatsz.</Text> : null}
    {result ? <FreeTimeResults result={result} profiles={app.profileList} /> : null}
    {error ? <Text accessibilityRole="alert" className="text-destructive">{error}</Text> : null}
  </Modal>;
}

function FreeTimeResults({ result, profiles }: { result: FreeTimeResult; profiles: { id: number; name: string }[] }) {
  function missingNames(ids: number[]) { return profiles.filter(profile => ids.includes(profile.id)).map(profile => profile.name).join(', '); }
  return <View className="gap-3"><Text className="font-semibold">{result.slots.length} egybefüggő lehetőség</Text>
    {result.slots.map(slot => <View key={slot.start} className="flex-row items-start gap-2 border-t border-border pt-3"><Icon as={Clock3} size={17} className="mt-1 text-primary" /><View className="min-w-0 flex-1"><Text className="font-medium text-primary">{slotLabel(slot.start)} – {slotLabel(slot.end)}</Text><Text className="text-xs text-muted-foreground">{Math.round((slot.end - slot.start) / 60000)} perc</Text></View></View>)}
    {!result.slots.length ? <Text>Nincs igazolt közös szabad idő a megadott feltételekkel.</Text> : null}
    {result.missing.map(day => <Text key={day.date} className="text-xs text-muted-foreground">{day.date}: nincs importált adat – {missingNames(day.profileIds)}</Text>)}
  </View>;
}
function slotLabel(time: number) { return wallTime(time).slice(0, 16).replace('T', ' '); }
