import { useState } from 'react';
import { Pressable, View } from 'react-native';
import { Check, Palette, RotateCcw } from 'lucide-react-native';
import { Text } from '@/components/ui/text';
import { Icon } from '@/components/ui/icon';
import { Action, Choice, Field, Modal, Toggle } from './controls';
import { useApp } from './app-state';
import type { DisplayEvent } from '../domain/model';
import { colorOccurrenceKey, colorSeriesKey, DEFAULT_EVENT_COLORS, EVENT_PALETTE, isDeadline, isHexColor, validateUrgencyRules, type UrgencyRules } from '../domain/event-colors';

/** Keeps global countdown rules editable independently for lessons and deadlines. */
export function GlobalColorEditor() {
  const app = useApp(); const [category, setCategory] = useState('lesson'); const [open, setOpen] = useState(false);
  const [error, setError] = useState('');
  const key = category === 'deadline' ? 'deadline' : 'lesson';
  async function save(rules: UrgencyRules) {
    try { validateUrgencyRules(rules); await app.saveEventColors({ ...app.eventColors, [key]: rules }); setError(''); setOpen(false); }
    catch (error) { setError(String(error)); }
  }
  return <View className="gap-3 rounded-xl border border-border p-4"><View className="flex-row items-center gap-2"><Icon as={Palette} size={19} className="text-primary" /><Text className="font-semibold">Közelgő események színei</Text></View>
    <Choice fullWidth label="Színezés típusa" value={category} onChange={setCategory} options={[{ value: 'lesson', label: 'Tanórák' }, { value: 'deadline', label: 'Beadandók, ZH-k, vizsgák és feladatok' }]} />
    <Action secondary expanded={open} onPress={() => setOpen(!open)}>Színek és küszöbök</Action>
    {open ? <UrgencyEditor key={key} initial={app.eventColors[key]} deadline={key === 'deadline'} save={rules => void save(rules)} /> : null}
    {error ? <Text accessibilityRole="alert" className="text-destructive">{error}</Text> : null}
  </View>;
}

export function EventColorDialog({ event, close }: { event: DisplayEvent; close: () => void }) {
  const app = useApp(); const key = colorSeriesKey(event); const occurrence = colorOccurrenceKey(event);
  const [color, setColor] = useState(app.eventColors.series[key]?.color ?? '');
  const [custom, setCustom] = useState(Boolean(app.eventColors.occurrences[occurrence] ?? app.eventColors.series[key]?.urgency));
  const [scope, setScope] = useState(app.eventColors.occurrences[occurrence] ? 'occurrence' : 'series');
  const [error, setError] = useState(''); const deadline = isDeadline(event.category);
  const initial = app.eventColors.occurrences[occurrence] ?? app.eventColors.series[key]?.urgency ?? (deadline ? app.eventColors.deadline : app.eventColors.lesson);
  async function save(rules?: UrgencyRules) {
    try {
      if (color && !isHexColor(color)) throw new Error('Érvényes színkód szükséges, például #4ade80.');
      if (custom && rules) validateUrgencyRules(rules);
      const series = { ...app.eventColors.series, [key]: { ...app.eventColors.series[key], color: color || undefined } };
      const occurrences = { ...app.eventColors.occurrences };
      if (scope === 'series') series[key].urgency = custom ? rules : undefined;
      else if (custom && rules) occurrences[occurrence] = rules;
      else delete occurrences[occurrence];
      await app.saveEventColors({ ...app.eventColors, series, occurrences }); close();
    } catch (error) { setError(String(error)); }
  }
  return <Modal title="Esemény színezése" close={close}>
    <Text className="text-sm text-muted-foreground">Az alapszín e profil azonos típusú óráira érvényes. Az előadás és a gyakorlat külön színezhető.</Text>
    <ColorField label="Órasorozat színe" value={color} onChange={setColor} />
    <Action quiet icon={RotateCcw} onPress={() => setColor('')}>Alapszín törlése</Action>
    <Toggle label="Egyéni közelgő színezés" checked={custom} onChange={setCustom} />
    <Choice fullWidth label="Közelgő színezés hatóköre" value={scope} onChange={setScope} options={[{ value: 'series', label: 'Az összes ilyen óra' }, { value: 'occurrence', label: 'Csak ez az alkalom' }]} />
    {custom ? <UrgencyEditor initial={initial} deadline={deadline} save={rules => void save(rules)} /> : <Action icon={Check} onPress={() => void save()}>Színezés mentése</Action>}
    {error ? <Text accessibilityRole="alert" className="text-destructive">{error}</Text> : null}
  </Modal>;
}

function UrgencyEditor({ initial, deadline, save }: { initial: UrgencyRules; deadline: boolean; save: (rules: UrgencyRules) => void }) {
  const [rules, setRules] = useState(initial);
  function change(patch: Partial<UrgencyRules>) { setRules(current => ({ ...current, ...patch })); }
  return <View className="gap-4">
    <Text className="text-xs text-muted-foreground">A küszöbök percekben értendők. A legközelebbi küszöb színe jelenik meg az időpontnál és a körvonalon.</Text>
    {deadline ? <Field label="Távolabbi jelzés: ennyi percen belül" value={String(rules.greenMinutes ?? '')} onChange={value => change({ greenMinutes: Number(value) })} /> : <Text className="text-sm">A közelgő küszöbnél távolabbi órák a távolabbi jelzést kapják.</Text>}
    <ColorField label="Távolabbi esemény színe" value={rules.green} onChange={green => change({ green })} />
    <Field label="Közelgő: ennyi percen belül" value={String(rules.yellowMinutes)} onChange={value => change({ yellowMinutes: Number(value) })} />
    <ColorField label="Közelgő esemény színe" value={rules.yellow} onChange={yellow => change({ yellow })} />
    <Field label="Sürgős: ennyi percen belül" value={String(rules.redMinutes)} onChange={value => change({ redMinutes: Number(value) })} />
    <ColorField label="Sürgős esemény színe" value={rules.red} onChange={red => change({ red })} />
    <Action secondary icon={RotateCcw} onPress={() => setRules(deadline ? DEFAULT_EVENT_COLORS.deadline : DEFAULT_EVENT_COLORS.lesson)}>Alapértelmezett értékek</Action>
    <Action icon={Check} onPress={() => save(rules)}>Színezés mentése</Action>
  </View>;
}
function ColorField({ label, value, onChange }: { label: string; value: string; onChange: (color: string) => void }) {
  return <View className="gap-2"><Text className="text-sm font-medium">{label}</Text><View className="flex-row flex-wrap gap-2">{EVENT_PALETTE.map(color => <Pressable key={color} accessibilityRole="button" accessibilityLabel={`${label}: ${color}`} accessibilityState={{ selected: value.toLowerCase() === color }} onPress={() => onChange(color)} style={{ width: 34, height: 34, borderRadius: 17, backgroundColor: color, alignItems: 'center', justifyContent: 'center' }}>{value.toLowerCase() === color ? <Icon as={Check} size={18} color="#111827" /> : null}</Pressable>)}</View><Field label={`${label} – egyéni színkód`} value={value} onChange={onChange} placeholder="#4ade80" /></View>;
}
