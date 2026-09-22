import { Linking, Platform, View } from 'react-native';
import { Text } from '@/components/ui/text';
import { Progress } from '@/components/ui/progress';
import { Textarea } from '@/components/ui/textarea';
import { calendarUrl } from '../data/calendar-fetch';
import { Action, Choice, Confirm, Field, Modal } from './controls';
import { useApp } from './app-state';
import { useImport } from './use-import';

export function ImportDialog({ profileId, close }: { profileId: number; close: () => void }) {
  const { profileList } = useApp();
  const state = useImport(profileId, close);
  const { draft, update, stage, busy, count, error } = state;
  const own = profileList.find(profile => profile.id === profileId)?.isOwn;
  const options = [{ value: 'file', label: 'ICS / JSON fájl' }, ...(own ? [{ value: 'url', label: 'Saját naptárlink' }] : [])];
  function finish() { if (busy) { state.cancel(); return; } close(); }
  return <Modal title="Órarend importálása" description={own ? 'Saját naptárlink vagy helyi fájl. A meglévő kézi órák megmaradnak.' : 'Csoporttárs órarendje: helyi fájl, automatikus frissítés nélkül.'} close={finish}>
    <View pointerEvents={busy || stage ? 'none' : 'auto'} className="gap-4">
      <Choice label="Import forrása" value={draft.mode} options={options} onChange={mode => update({ mode: mode === 'url' ? 'url' : 'file' })} />
      {draft.mode === 'url' ? <><Field label="Naptár HTTPS / webcal link" value={draft.url} onChange={url => update({ url })} placeholder="https://…" /><Text className="text-xs text-muted-foreground">{Platform.OS === 'web' ? 'Egyszeri letöltés. Weben nincs automatikus frissítés.' : 'Saját órarended 15 percenként frissül használat közben. Háttérben a rendszer ütemez.'}</Text></> : <>
        <Action secondary onPress={() => void state.pick()}>Fájl kiválasztása</Action>
        <Text className="text-sm text-muted-foreground">{draft.content ? draft.name : 'Üres tartalom: a tárolt forrás időtartományának bővítése'}</Text>
        <Textarea accessibilityLabel="ICS vagy JSON tartalom" value={draft.content} onChangeText={content => update({ content })} placeholder="Vagy illeszd be a fájl tartalmát…" className="h-24" />
      </>}
      <Field label="Import kezdete (ÉÉÉÉ-HH-NN)" value={draft.from} onChange={from => update({ from })} /><Field label="Import vége (ÉÉÉÉ-HH-NN)" value={draft.to} onChange={to => update({ to })} />
    </View>
    {error ? <Text accessibilityRole="alert" className="text-destructive">{error}</Text> : null}
    {error && draft.mode === 'url' && Platform.OS === 'web' ? <DownloadFallback url={draft.url} pick={state.pick} report={state.report} /> : null}
    {busy ? <><Progress value={undefined} accessibilityLabel="Import folyamatban" /><Text>{count} feldolgozott elem</Text><Action secondary onPress={state.cancel}>Megszakítás</Action></> : <Action disabled={Boolean(stage)} onPress={() => void state.prepare()}>Ellenőrzés és előnézet</Action>}
    {stage ? <Confirm title="Import jóváhagyása" description={`${stage.count} alkalom. Új: ${stage.added}, módosult: ${stage.changed}, eltűnik: ${stage.removed}, törlődő felülírás: ${stage.lostOverrides}. A kézi órák megmaradnak.`} accept={() => void state.accept()} cancel={() => { if (!busy) void state.cancelStage(); }} /> : null}
  </Modal>;
}
function DownloadFallback({ url, pick, report }: { url: string; pick: () => Promise<void>; report: (error: unknown) => void }) {
  async function download() { try { await Linking.openURL(calendarUrl(url)); } catch { report(new Error('Nem sikerült megnyitni a letöltést.')); } }
  return <View className="gap-2 rounded-lg border border-border p-3"><Text>A böngésző blokkolhatja a közvetlen importot. Töltsd le a naptárt, majd válaszd ki a fájlt.</Text>
    <Action secondary onPress={() => void download()}>1. Naptár letöltése</Action><Action secondary onPress={() => void pick()}>2. Letöltött ICS kiválasztása</Action>
  </View>;
}
