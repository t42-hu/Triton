import { Linking, Platform, View, useWindowDimensions } from 'react-native';
import { CalendarRange, FileUp, Link2, SearchCheck, X, Download } from 'lucide-react-native';
import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { Progress } from '@/components/ui/progress';
import { Textarea } from '@/components/ui/textarea';
import { calendarUrl } from '../data/calendar-fetch';
import { Action, Choice, Confirm, Field, Modal } from './controls';
import { useApp } from './app-state';
import { SetupHeader } from './setup-header';
import { useImport, type ImportDraft } from './use-import';
import { DateField } from './date-time-field';

export function ImportDialog({ profileId, close, required = false, open = true, onBack, onAccount }: { onAccount?: () => void; open?: boolean; onBack?: () => void; required?: boolean; profileId: number; close: () => void }) {
  const { profileList } = useApp();
  const state = useImport(profileId, close);
  const { draft, update, stage, busy, count, error } = state;
  const own = profileList.find(profile => profile.id === profileId)?.isOwn;
  const options = [{ value: 'url', label: 'Naptárlink' }, { value: 'file', label: 'ICS / JSON fájl' }];
  const compact = useWindowDimensions().width < 600;
  function finish() { if (required) return; if (busy) { state.cancel(); return; } close(); }
  const submit = busy ? <Action secondary icon={X} onPress={state.cancel}>Megszakítás</Action> : <Button className={required ? 'h-12 w-full rounded-lg' : undefined} accessibilityLabel="Ellenőrzés és előnézet" disabled={Boolean(stage)} onPress={() => void state.prepare()}><Icon as={SearchCheck} size={17} className="text-primary-foreground" /><Text>Ellenőrzés és előnézet</Text></Button>;
  return <Modal footer={required ? submit : undefined} open={open} keepMounted={required} setup={required} header={required ? <SetupHeader step={2} disabled={busy || Boolean(stage)} onStepChange={step => { if (step === 0) onAccount?.(); else if (step === 1) onBack?.(); }} /> : undefined} dismissible={!required} title={`${profileList.find(profile => profile.id === profileId)?.name ?? 'Órarend'} importálása`} description="Naptárlinkből vagy fájlból. A kézi órák megmaradnak." close={finish}>
    <View pointerEvents={busy || stage ? 'none' : 'auto'} className="gap-4">
      <View className={`gap-3 border-t border-border pt-4 ${compact ? '' : 'flex-row'}`}>

        <View className={compact ? 'min-w-0 gap-2' : 'min-w-0 flex-1 gap-2'}><View className="flex-row items-center gap-2"><Icon as={draft.mode === 'url' ? Link2 : FileUp} size={17} className="text-primary" /><Text className="text-sm font-semibold">Forrás</Text></View><Choice fullWidth label="Import forrása" value={draft.mode} options={options} onChange={mode => update({ mode: mode === 'url' ? 'url' : 'file' })} /></View>
      </View>
      <ImportSourceFields own={Boolean(own)} draft={draft} update={update} pick={state.pick} />
      <ImportRange draft={draft} update={update} compact={compact} />
    </View>
    {error ? <Text accessibilityRole="alert" className="text-destructive">{error}</Text> : null}
    {error && draft.mode === 'url' && Platform.OS === 'web' ? <DownloadFallback url={draft.url} pick={state.pick} report={state.report} /> : null}
    {busy ? <><Progress value={undefined} accessibilityLabel="Import folyamatban" /><Text>{count} feldolgozott elem</Text></> : null}
    {!required ? submit : null}
    {stage ? <Confirm title="Import jóváhagyása" description={`${stage.count} alkalom. Új: ${stage.added}, módosult: ${stage.changed}, eltűnik: ${stage.removed}, törlődő felülírás: ${stage.lostOverrides}. A kézi órák megmaradnak.`} accept={() => void state.accept()} cancel={() => { if (!busy) void state.cancelStage(); }} /> : null}
  </Modal>;
}
function ImportSourceFields({ own, draft, update, pick }: { own: boolean; draft: ImportDraft; update: (patch: Partial<ImportDraft>) => void; pick: () => Promise<void> }) {
  if (draft.mode === 'url') return <View className="gap-3 border-t border-border pt-4"><View className="flex-row items-center gap-2"><Icon as={Link2} size={18} className="text-primary" /><Text className="font-semibold">Naptárlink</Text></View><Field label="Naptár HTTPS / webcal link" value={draft.url} onChange={url => update({ url })} placeholder="https://…" /><Text className="text-xs text-muted-foreground">{Platform.OS === 'web' ? 'Egyszeri letöltés. Weben nincs automatikus frissítés.' : own ? 'Használat közben 15 percenként ellenőrizzük a linket. A háttérfrissítést a rendszer ütemezi.' : 'A link betölthető. Az automatikus frissítéshez jelöld sajátként ezt a profilt.'}</Text></View>;
  return <View className="gap-3 border-t border-border pt-4">
    <View className="flex-row items-center gap-2"><Icon as={FileUp} size={18} className="text-primary" /><Text className="font-semibold">ICS vagy JSON fájl</Text></View>
    <Text className="text-xs text-muted-foreground">Válassz fájlt, vagy illeszd be a tartalmát.</Text>
    <Action secondary icon={FileUp} onPress={() => void pick()}>Fájl kiválasztása</Action>
    {draft.content ? <Text className="text-sm text-muted-foreground" numberOfLines={1}>{draft.name}</Text> : null}
    <Textarea accessibilityLabel="ICS vagy JSON tartalom" value={draft.content} onChangeText={content => update({ content })} placeholder="Fájltartalom beillesztése…" className="h-24" />
    {!draft.content ? <Text className="text-xs text-muted-foreground">Korábbi import időtartamát tartalom nélkül is bővítheted.</Text> : null}
  </View>;
}
function ImportRange({ draft, update, compact }: { draft: ImportDraft; update: (patch: Partial<ImportDraft>) => void; compact: boolean }) {
  return <View className="gap-3 border-t border-border pt-4"><View className="flex-row items-center gap-2"><Icon as={CalendarRange} size={18} className="text-primary" /><Text className="font-semibold">Importálási időszak</Text></View><View className={compact ? 'gap-3' : 'flex-row gap-3'}>
    <View className={compact ? 'min-w-0' : 'min-w-0 flex-1'}><DateField label="Import kezdete" value={draft.from} onChange={from => update({ from })} /></View>
    <View className={compact ? 'min-w-0' : 'min-w-0 flex-1'}><DateField label="Import vége" value={draft.to} onChange={to => update({ to })} /></View>
  </View></View>;
}
function DownloadFallback({ url, pick, report }: { url: string; pick: () => Promise<void>; report: (error: unknown) => void }) {
  async function download() { try { await Linking.openURL(calendarUrl(url)); } catch { report(new Error('Nem sikerült megnyitni a letöltést.')); } }
  return <View className="gap-2 rounded-lg border border-border p-3"><Text>A böngésző blokkolhatja a közvetlen importot. Töltsd le a naptárt, majd válaszd ki a fájlt.</Text>
    <Action secondary icon={Download} onPress={() => void download()}>1. Naptár letöltése</Action><Action secondary icon={FileUp} onPress={() => void pick()}>2. Letöltött ICS kiválasztása</Action>
  </View>;
}
