import { Pressable, View } from 'react-native';
import { Check, Link2 } from 'lucide-react-native';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { Action } from './controls';
import { EVENT_CATEGORIES } from '@/domain/student';
import type { ShareOptions, ShareSelection, ShareSource } from '@/data/calendar-links';

export function defaultShareSelection(options: ShareOptions): ShareSelection {
  return { sourceIds: options.sources.filter(source => source.type !== 'manual').map(source => source.id), includeManual: true, categories: EVENT_CATEGORIES.map(category => category.value) };
}
function toggle<T>(items: T[], value: T) { return items.includes(value) ? items.filter(item => item !== value) : [...items, value]; }
/** Source and category filters intersect; new events in selected sources remain part of the live feed. */
export function ShareSelectionForm({ options, selection, onChange, busy, create }: { options: ShareOptions; selection: ShareSelection; onChange: (value: ShareSelection) => void; busy: boolean; create: () => void }) {
  function selectSource(id: string) { onChange({ ...selection, sourceIds: toggle(selection.sourceIds, id) }); }
  return <View className="gap-4 rounded-lg border border-border bg-muted/20 p-3">
    <Text className="font-medium">{options.name}</Text>
    <SourceChoices title="Importált ICS-ek" sources={options.sources.filter(source => source.type === 'ics')} selected={selection.sourceIds} change={selectSource} disabled={busy} />
    <SourceChoices title="Importált naptárlinkek" sources={options.sources.filter(source => source.type === 'link')} selected={selection.sourceIds} change={selectSource} disabled={busy} />
    <SourceChoices title="Egyéb importok" sources={options.sources.filter(source => source.type === 'json')} selected={selection.sourceIds} change={selectSource} disabled={busy} hideEmpty />
    <CheckRow label="Kézzel létrehozott események" checked={selection.includeManual} disabled={busy} onPress={() => onChange({ ...selection, includeManual: !selection.includeManual })} />
    <View className="gap-1 border-t border-border pt-3"><Text className="mb-1 text-sm font-semibold">Kategóriák</Text>{EVENT_CATEGORIES.map(category => <CheckRow key={category.value} label={category.label} checked={selection.categories.includes(category.value)} disabled={busy} onPress={() => onChange({ ...selection, categories: toggle(selection.categories, category.value) })} />)}</View>
    <Text className="text-xs leading-5 text-muted-foreground">A kiválasztott források kijelölt kategóriái lesznek megosztva. A naptár-előfizetés frissítéskor követi a változásokat.</Text>
    <Action icon={Link2} disabled={busy || !selection.categories.length || (!selection.includeManual && !selection.sourceIds.length)} onPress={create}>{busy ? 'Létrehozás…' : 'Link létrehozása'}</Action>
  </View>;
}
function SourceChoices({ title, sources, selected, change, disabled, hideEmpty = false }: { title: string; sources: ShareSource[]; selected: string[]; change: (id: string) => void; disabled: boolean; hideEmpty?: boolean }) {
  if (hideEmpty && !sources.length) return null;
  return <View className="gap-1"><Text className="text-sm font-semibold">{title}</Text>{sources.length ? sources.map(source => <CheckRow key={source.id} label={source.name} detail={`${source.eventCount} esemény`} checked={selected.includes(source.id)} disabled={disabled} onPress={() => change(source.id)} />) : <Text className="py-2 text-xs text-muted-foreground">Nincs ilyen import a saját profilodban.</Text>}</View>;
}
function CheckRow({ label, detail, checked, disabled, onPress }: { label: string; detail?: string; checked: boolean; disabled: boolean; onPress: () => void }) {
  return <Pressable accessibilityRole="checkbox" accessibilityLabel={label} accessibilityState={{ checked, disabled }} disabled={disabled} onPress={onPress} className="min-h-12 flex-row items-center gap-3 rounded-lg px-1 py-2 hover:bg-accent/60 active:bg-accent">
    <View pointerEvents="none" className={`size-5 items-center justify-center rounded border ${checked ? 'border-primary bg-primary' : 'border-input bg-card'}`}><Icon as={Check} size={14} className={checked ? 'text-primary-foreground' : 'opacity-0'} /></View>
    <View pointerEvents="none" className="min-w-0 flex-1 gap-1"><Text className="text-sm">{label}</Text>{detail ? <Text className="text-xs text-muted-foreground">{detail}</Text> : null}</View>
  </Pressable>;
}
