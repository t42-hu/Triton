import { AccountSettings } from './account-settings';
import { GlobalColorEditor } from './event-color-editor';
import { useEffect, useRef, useState } from 'react';
import { View } from 'react-native';
import { ArrowLeft, CalendarRange, ChevronRight, Palette, RefreshCw, Repeat2, type LucideIcon } from 'lucide-react-native';
import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { Switch } from '@/components/ui/switch';
import { Text } from '@/components/ui/text';
import type { Anchor } from '../domain/model';
import { monday, validDate } from '../domain/time';
import { sources } from '../data/repository';
import { discardStages, publishStages, stageSource, type StagedSource } from '../data/importer';
import { useApp } from './app-state';
import { DateField } from './date-time-field';
import { Action, Choice, Confirm, Modal } from './controls';

export function SettingsDialog({ close }: { close: () => void }) {
  const app = useApp();
  const [category, setCategory] = useState<SettingsCategory | null>(null);
  const [date, setDate] = useState(app.anchor.date);
  const [week, setWeek] = useState(app.anchor.week);
  const [stages, setStages] = useState<StagedSource[]>([]);
  const [prepared, setPrepared] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const controller = useRef(new AbortController());
  const staged = useRef<StagedSource[]>([]);
  useEffect(() => () => { controller.current.abort(); void discardStages(staged.current); }, []);
  async function prepare() {
    const built: StagedSource[] = []; setBusy(true); setError(''); controller.current = new AbortController();
    try {
      if (!validDate(date) || monday(date) !== date) throw new Error('A referencia érvényes hétfő legyen.');
      const candidates = (await sources()).filter(source => source.format === 'json');
      for (const source of candidates) built.push(await stageSource(source, { date, week }, { signal: controller.current.signal, progress: () => undefined }));
      if (controller.current.signal.aborted) { await discardStages(built); return; }
      staged.current = built; setStages(built); setPrepared(true);
    } catch (error) { await discardStages(built); setError(String(error)); } finally { setBusy(false); }
  }
  async function accept() {
    try { await publishStages(stages, { date, week }); await app.refresh(); close(); }
    catch (error) { setError(String(error)); setPrepared(false); await discardStages(stages); }
  }
  function cancel() { controller.current.abort(); void discardStages(stages); close(); }
  const summary = stages.reduce((sum, stage) => ({ added: sum.added + stage.added, removed: sum.removed + stage.removed, lost: sum.lost + stage.lostOverrides }), { added: 0, removed: 0, lost: 0 });
  return <Modal title={categories.find(item => item.key === category)?.title ?? "Beállítások"} close={cancel}>
    <SettingsOptions category={category} setCategory={setCategory} date={date} setDate={setDate} week={week} setWeek={setWeek} busy={busy} error={error} prepare={() => void prepare()} abort={() => controller.current.abort()} />
    {prepared ? <Confirm title="A/B rend módosítása" description={`Létrejön: ${summary.added}, eltűnik: ${summary.removed} alkalom. Törlődő felülírás: ${summary.lost}.`} accept={() => void accept()} cancel={() => { setPrepared(false); void discardStages(stages); }} /> : null}
  </Modal>;
}
type SettingsOptionsProps = { date: string; setDate: (date: string) => void; week: Anchor['week']; setWeek: (week: Anchor['week']) => void; busy: boolean; error: string; prepare: () => void; abort: () => void };
type SettingsCategory = 'appearance' | 'calendar' | 'weeks' | 'colors' | 'sync';
const categories: { key: SettingsCategory; title: string; icon: LucideIcon }[] = [
  { key: 'appearance', title: 'Megjelenés', icon: Palette },
  { key: 'calendar', title: 'Órarend', icon: CalendarRange },
  { key: 'weeks', title: 'A/B hetek', icon: Repeat2 },
  { key: 'colors', title: 'Eseményszínek', icon: Palette },
  { key: 'sync', title: 'Szinkronizálás', icon: RefreshCw },
];
function SettingsOptions({ category, setCategory, ...options }: SettingsOptionsProps & { category: SettingsCategory | null; setCategory: (value: SettingsCategory | null) => void }) {
  return <View className="gap-4">
    {category ? <Button variant="ghost" className="self-start justify-start px-0" accessibilityLabel="Vissza a beállításokhoz" onPress={() => setCategory(null)}><Icon as={ArrowLeft} size={17} className="text-muted-foreground" /><Text className="text-sm text-muted-foreground">Beállítások</Text></Button> : <View>
      {categories.map((item, index) => <Button key={item.key} variant="ghost" accessibilityLabel={`${item.title} beállításai`} className={`h-14 justify-start gap-3 rounded-none px-1 ${index < categories.length - 1 ? 'border-b border-border' : ''}`} onPress={() => setCategory(item.key)}>
        <Icon as={item.icon} size={20} className="text-muted-foreground" />
        <Text className="min-w-0 flex-1 text-sm font-medium">{item.title}</Text>
        <Icon as={ChevronRight} size={17} className="text-muted-foreground" />
      </Button>)}
    </View>}
    <View style={{ display: category === 'appearance' ? 'flex' : 'none' }}><AppearanceSettings /></View>
    <View style={{ display: category === 'calendar' ? 'flex' : 'none' }}><CalendarSettings /></View>
    <View style={{ display: category === 'weeks' ? 'flex' : 'none' }}><WeekSettings {...options} /></View>
    <View style={{ display: category === 'colors' ? 'flex' : 'none' }}><GlobalColorEditor /></View>
    <View style={{ display: category === 'sync' ? 'flex' : 'none' }}><AccountSettings showSignOut={false} /></View>
  </View>;
}

function AppearanceSettings() {
  const app = useApp();
  return <View className="gap-2"><Text className="text-sm font-medium">Téma</Text>
    <Choice fullWidth label="Téma" value={app.view.theme} onChange={theme => app.setView({ theme: theme as 'system' | 'light' | 'dark' })} options={[{ value: 'system', label: 'Rendszer' }, { value: 'light', label: 'Világos' }, { value: 'dark', label: 'Sötét' }]} />
  </View>;
}
function CalendarSettings() {
  const app = useApp();
  return <View className="gap-6">
    <View>
      <SettingsSwitch title="Hétvégék" checked={app.view.showWeekends} onChange={showWeekends => app.setView({ showWeekends })} />
      <SettingsSwitch title="Elrejtett alkalmak" checked={app.view.hidden} onChange={hidden => app.setView({ hidden })} />
    </View>

  </View>;
}
function WeekSettings({ date, setDate, week, setWeek, busy, error, prepare, abort }: SettingsOptionsProps) {
  return <View className="gap-4">
    <DateField label="Referenciahét hétfője" value={date} onChange={setDate} />
    <View className="gap-2"><Text className="text-sm font-medium">Hét típusa</Text><Choice fullWidth label="Referenciahét jele" value={week} onChange={value => setWeek(value as Anchor['week'])} options={[{ value: 'A', label: 'A hét' }, { value: 'B', label: 'B hét' }]} /></View>
    <Text className="text-xs leading-5 text-muted-foreground">Minden profil A/B rendjére érvényes.</Text>
    {error ? <Text accessibilityRole="alert" className="text-sm text-destructive">{error}</Text> : null}
    <Button accessibilityLabel="A/B változás előnézete" disabled={busy} onPress={prepare}><Icon as={RefreshCw} size={17} className="text-primary-foreground" /><Text>{busy ? 'Újraszámítás…' : 'Előnézet'}</Text></Button>
    {busy ? <Action secondary onPress={abort}>Megszakítás</Action> : null}
  </View>;
}
function SettingsSwitch({ title, checked, onChange }: { title: string; checked: boolean; onChange: (value: boolean) => void }) {
  return <View className="min-h-14 flex-row items-center justify-between gap-4 border-b border-border py-3"><Text className="min-w-0 flex-1 text-sm">{title}</Text><Switch accessibilityLabel={title} checked={checked} onCheckedChange={onChange} /></View>;
}
