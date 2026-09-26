import { useEffect, useRef, useState } from 'react';
import { View, useWindowDimensions } from 'react-native';
import { CalendarRange, Eye, Palette, RefreshCw } from 'lucide-react-native';
import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { Switch } from '@/components/ui/switch';
import { Text } from '@/components/ui/text';
import type { Anchor } from '../domain/model';
import { monday, validDate } from '../domain/time';
import { sources } from '../data/repository';
import { discardStages, publishStages, stageSource, type StagedSource } from '../data/importer';
import { useApp } from './app-state';
import { Action, Choice, Confirm, Field, Modal } from './controls';

export function SettingsDialog({ close }: { close: () => void }) {
  const app = useApp();
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
  return <Modal title="Beállítások" description="Szabd az órarendet a saját hetedhez." close={cancel}>
    <SettingsOptions date={date} setDate={setDate} week={week} setWeek={setWeek} busy={busy} error={error} prepare={() => void prepare()} abort={() => controller.current.abort()} />
    {prepared ? <Confirm title="A/B rend módosítása" description={`Létrejön: ${summary.added}, eltűnik: ${summary.removed} alkalom. Törlődő felülírás: ${summary.lost}.`} accept={() => void accept()} cancel={() => { setPrepared(false); void discardStages(stages); }} /> : null}
  </Modal>;
}
type SettingsOptionsProps = { date: string; setDate: (date: string) => void; week: Anchor['week']; setWeek: (week: Anchor['week']) => void; busy: boolean; error: string; prepare: () => void; abort: () => void };
function SettingsOptions({ date, setDate, week, setWeek, busy, error, prepare, abort }: SettingsOptionsProps) {
  const app = useApp();
  const compact = useWindowDimensions().width < 600;
  return <>
    <View className="gap-4 rounded-xl border border-border bg-background/40 p-4">
      <View className="flex-row items-center gap-2"><Icon as={Palette} size={19} className="text-primary" /><Text className="font-semibold">Megjelenés</Text></View>
      <View className={compact ? 'gap-2' : 'flex-row items-center justify-between gap-3'}><Text className="text-sm">Téma</Text><Choice fullWidth={compact} label="Megjelenés" value={app.view.theme} onChange={theme => app.setView({ theme: theme as 'system' | 'light' | 'dark' })} options={[{ value: 'system', label: 'Rendszer témája' }, { value: 'light', label: 'Világos' }, { value: 'dark', label: 'Sötét' }]} /></View>
      <View className="flex-row items-center justify-between gap-3 border-t border-border pt-3"><View className="min-w-0 flex-1 flex-row items-center gap-2"><Icon as={Eye} size={17} className="text-muted-foreground" /><Text className="shrink text-sm">Elrejtett alkalmak mutatása</Text></View><Switch accessibilityLabel="Elrejtett alkalmak mutatása" checked={app.view.hidden} onCheckedChange={hidden => app.setView({ hidden })} /></View>
    </View>
    <View className="gap-4 rounded-xl border border-border bg-background/40 p-4">
      <View className="flex-row items-center gap-2"><Icon as={CalendarRange} size={19} className="text-primary" /><Text className="font-semibold">A/B hetek</Text></View>
      <Text className="text-xs leading-5 text-muted-foreground">A referenciahét minden profilra érvényes. A dátumhoz kötött ICS-események nem változnak.</Text>
      <Field label="Referenciahét hétfője" value={date} onChange={setDate} />
      <View className={compact ? 'gap-2' : 'flex-row items-center justify-between gap-3'}><Text className="text-sm">Hét</Text><Choice fullWidth={compact} label="Referenciahét jele" value={week} onChange={value => setWeek(value as Anchor['week'])} options={[{ value: 'A', label: 'A hét' }, { value: 'B', label: 'B hét' }]} /></View>
      {error ? <Text accessibilityRole="alert" className="text-destructive">{error}</Text> : null}
      <Button accessibilityLabel="A/B változás előnézete" disabled={busy} onPress={prepare}><Icon as={RefreshCw} size={17} className="text-primary-foreground" /><Text>{busy ? 'Újraszámítás…' : 'A/B előnézet'}</Text></Button>
      {busy ? <Action secondary onPress={abort}>Megszakítás</Action> : null}
    </View>
  </>;
}
