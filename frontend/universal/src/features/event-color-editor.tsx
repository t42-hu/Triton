import { useState } from 'react';
import { View } from 'react-native';
import { Check, RotateCcw } from 'lucide-react-native';
import { Text } from '@/components/ui/text';
import { Action, Choice, Field, Modal, Toggle } from './controls';
import { ColorField } from './color-picker';
import { useApp } from './app-state';
import type { DisplayEvent } from '../domain/model';
import { colorOccurrenceKey, colorSeriesKey, DEFAULT_EVENT_COLORS, isDeadline, isHexColor, validateUrgencyRules, type UrgencyRules } from '../domain/event-colors';

/** Keeps global countdown rules editable independently for lessons and deadlines. */
export function GlobalColorEditor() {
  const app = useApp(); const [category, setCategory] = useState('lesson');
  const [error, setError] = useState('');
  const key = category === 'deadline' ? 'deadline' : 'lesson';
  async function save(rules: UrgencyRules) {
    try { validateUrgencyRules(rules); await app.saveEventColors({ ...app.eventColors, [key]: rules }); setError(''); }
    catch (error) { setError(String(error)); }
  }
  return <View className="gap-4">
    <Choice fullWidth label="Eseménytípus" value={category} onChange={setCategory} options={[{ value: 'lesson', label: 'Tanórák' }, { value: 'deadline', label: 'Határidők és feladatok' }]} />
    <UrgencyEditor key={key} initial={app.eventColors[key]} deadline={key === 'deadline'} save={rules => void save(rules)} />
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
    <Text className="text-sm text-muted-foreground">Az alapszín a profil azonos típusú óráira érvényes.</Text>
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
    <UrgencyGroup title="Távolabbi" color={rules.green} setColor={green => change({ green })} minutes={deadline ? rules.greenMinutes ?? 0 : undefined} setMinutes={greenMinutes => change({ greenMinutes })} />
    <UrgencyGroup title="Közelgő" color={rules.yellow} setColor={yellow => change({ yellow })} minutes={rules.yellowMinutes} setMinutes={yellowMinutes => change({ yellowMinutes })} />
    <UrgencyGroup title="Sürgős" color={rules.red} setColor={red => change({ red })} minutes={rules.redMinutes} setMinutes={redMinutes => change({ redMinutes })} />
    <Action icon={Check} onPress={() => save(rules)}>Mentés</Action>
    <Action quiet icon={RotateCcw} onPress={() => setRules(deadline ? DEFAULT_EVENT_COLORS.deadline : DEFAULT_EVENT_COLORS.lesson)}>Alapértékek visszaállítása</Action>
  </View>;
}
function UrgencyGroup({ title, color, setColor, minutes, setMinutes }: { title: string; color: string; setColor: (value: string) => void; minutes?: number; setMinutes: (value: number) => void }) {
  return <View className="gap-3 border-t border-border pt-4">
    <Text className="text-sm font-semibold">{title}</Text>
    <View className="flex-row items-end gap-3">
      <View className="min-w-0 flex-1"><ColorField hideLabel label={`${title} színe`} value={color} onChange={setColor} /></View>
      {minutes !== undefined ? <View className="w-28"><Field label="Határ (perc)" value={String(minutes)} onChange={value => setMinutes(Number(value))} /></View> : null}
    </View>
    {minutes === undefined ? <Text className="text-xs text-muted-foreground">A közelgő határon túl.</Text> : null}
  </View>;
}
