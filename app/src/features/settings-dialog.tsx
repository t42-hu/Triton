import { ReminderDialog } from './reminder-dialog';
import { useEffect, useRef, useState } from 'react';
import { Text } from '@/components/ui/text';
import type { Anchor } from '../domain/model';
import { monday, validDate } from '../domain/time';
import { sources } from '../data/repository';
import { discardStages, publishStages, stageSource, type StagedSource } from '../data/importer';
import { useApp } from './app-state';
import { Action, Choice, Confirm, Field, Modal, Toggle } from './controls';

export function SettingsDialog({ close }: { close: () => void }) {
  const app = useApp(); const [remindersOpen, setRemindersOpen] = useState(false);
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
  if (remindersOpen) return <ReminderDialog close={() => setRemindersOpen(false)} />;
  return <Modal title="Beállítások" description="Közös A/B rend minden profilhoz. A konkrét dátumú ICS-események változatlanok maradnak." close={cancel}>
    <Action secondary onPress={() => setRemindersOpen(true)}>Óra előtti értesítések</Action>
    <Choice label="Megjelenés" value={app.view.theme} onChange={theme => app.setView({ theme: theme as 'system' | 'light' | 'dark' })} options={[{ value: 'system', label: 'Rendszer témája' }, { value: 'light', label: 'Világos' }, { value: 'dark', label: 'Sötét' }]} />
    <Toggle label="Elrejtett alkalmak mutatása" checked={app.view.hidden} onChange={hidden => app.setView({ hidden })} />
    <Field label="Referenciahét hétfője" value={date} onChange={setDate} />
    <Choice label="Referenciahét jele" value={week} onChange={value => setWeek(value as Anchor['week'])} options={[{ value: 'A', label: 'A hét' }, { value: 'B', label: 'B hét' }]} />
    {error ? <Text accessibilityRole="alert" className="text-destructive">{error}</Text> : null}
    <Action disabled={busy} onPress={() => void prepare()}>{busy ? 'Újraszámítás…' : 'A/B változás előnézete'}</Action>
    {busy ? <Action secondary onPress={() => controller.current.abort()}>Megszakítás</Action> : null}
    {prepared ? <Confirm title="A/B rend módosítása" description={`Létrejön: ${summary.added}, eltűnik: ${summary.removed} alkalom. Törlődő felülírás: ${summary.lost}.`} accept={() => void accept()} cancel={() => { setPrepared(false); void discardStages(stages); }} /> : null}
  </Modal>;
}
