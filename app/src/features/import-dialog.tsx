import { Linking, Platform, View, useWindowDimensions } from 'react-native';
import { useState } from 'react';
import { CalendarRange, FileUp, Link2, SearchCheck, UsersRound } from 'lucide-react-native';
import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { Input } from '@/components/ui/input';
import { Text } from '@/components/ui/text';
import { Progress } from '@/components/ui/progress';
import { Textarea } from '@/components/ui/textarea';
import { calendarUrl } from '../data/calendar-fetch';
import { Action, Choice, Confirm, Field, Modal } from './controls';
import { useApp } from './app-state';
import { useImport, type ImportDraft } from './use-import';

export function ImportDialog({ profileId, close }: { profileId: number; close: () => void }) {
  const { profileList } = useApp();
  const [selectedId, setSelectedId] = useState(profileId);
  const state = useImport(selectedId, close);
  const { draft, update, stage, busy, count, error } = state;
  const own = profileList.find(profile => profile.id === selectedId)?.isOwn;
  const options = [{ value: 'file', label: 'ICS / JSON fájl' }, ...(own ? [{ value: 'url', label: 'Saját naptárlink' }] : [])];
  const compact = useWindowDimensions().width < 600;
  function finish() { if (busy) { state.cancel(); return; } close(); }
  function chooseProfile(id: string) {
    setSelectedId(Number(id));
    if (!profileList.find(profile => profile.id === Number(id))?.isOwn) update({ mode: 'file' });
  }
  return <Modal title="Órarend importálása" description={own ? 'Fájlból vagy saját naptárlinkből. A kézi órák megmaradnak.' : 'Helyi fájlból, automatikus frissítés nélkül. A kézi órák megmaradnak.'} close={finish}>
    <View pointerEvents={busy || stage ? 'none' : 'auto'} className="gap-4">
      <View className={`gap-3 rounded-xl border border-border bg-background/40 p-4 ${compact ? '' : 'flex-row'}`}>
        <View className="min-w-0 flex-1 gap-2"><View className="flex-row items-center gap-2"><Icon as={UsersRound} size={17} className="text-primary" /><Text className="text-sm font-semibold">Célprofil</Text></View><Choice fullWidth label="Célprofil" value={String(selectedId)} options={profileList.map(profile => ({ value: String(profile.id), label: profile.name }))} onChange={chooseProfile} /></View>
        <View className="min-w-0 flex-1 gap-2"><View className="flex-row items-center gap-2"><Icon as={draft.mode === 'url' ? Link2 : FileUp} size={17} className="text-primary" /><Text className="text-sm font-semibold">Forrás</Text></View><Choice fullWidth label="Import forrása" value={draft.mode} options={options} onChange={mode => update({ mode: mode === 'url' ? 'url' : 'file' })} /></View>
      </View>
      <ImportSourceFields draft={draft} update={update} pick={state.pick} />
      <ImportRange draft={draft} update={update} compact={compact} />
    </View>
    {error ? <Text accessibilityRole="alert" className="text-destructive">{error}</Text> : null}
    {error && draft.mode === 'url' && Platform.OS === 'web' ? <DownloadFallback url={draft.url} pick={state.pick} report={state.report} /> : null}
    {busy ? <><Progress value={undefined} accessibilityLabel="Import folyamatban" /><Text>{count} feldolgozott elem</Text><Action secondary onPress={state.cancel}>Megszakítás</Action></> : <Button accessibilityLabel="Ellenőrzés és előnézet" disabled={Boolean(stage)} onPress={() => void state.prepare()}><Icon as={SearchCheck} size={17} className="text-primary-foreground" /><Text>Ellenőrzés és előnézet</Text></Button>}
    {stage ? <Confirm title="Import jóváhagyása" description={`${stage.count} alkalom. Új: ${stage.added}, módosult: ${stage.changed}, eltűnik: ${stage.removed}, törlődő felülírás: ${stage.lostOverrides}. A kézi órák megmaradnak.`} accept={() => void state.accept()} cancel={() => { if (!busy) void state.cancelStage(); }} /> : null}
  </Modal>;
}
function ImportSourceFields({ draft, update, pick }: { draft: ImportDraft; update: (patch: Partial<ImportDraft>) => void; pick: () => Promise<void> }) {
  if (draft.mode === 'url') return <View className="gap-3 rounded-xl border border-border bg-background/40 p-4"><View className="flex-row items-center gap-2"><Icon as={Link2} size={18} className="text-primary" /><Text className="font-semibold">Naptárlink</Text></View><Field label="Naptár HTTPS / webcal link" value={draft.url} onChange={url => update({ url })} placeholder="https://…" /><Text className="text-xs text-muted-foreground">{Platform.OS === 'web' ? 'Egyszeri letöltés. Weben nincs automatikus frissítés.' : 'A saját órarend 15 percenként frissül használat közben. A háttérfrissítést a rendszer ütemezi.'}</Text></View>;
  return <View className="gap-3 rounded-xl border border-border bg-background/40 p-4">
    <View className="flex-row items-center gap-2"><Icon as={FileUp} size={18} className="text-primary" /><Text className="font-semibold">ICS vagy JSON fájl</Text></View>
    <Text className="text-xs text-muted-foreground">Válassz fájlt, vagy illeszd be a tartalmát.</Text>
    <Action secondary icon={FileUp} onPress={() => void pick()}>Fájl kiválasztása</Action>
    {draft.content ? <Text className="text-sm text-muted-foreground" numberOfLines={1}>{draft.name}</Text> : null}
    <Textarea accessibilityLabel="ICS vagy JSON tartalom" value={draft.content} onChangeText={content => update({ content })} placeholder="Fájltartalom beillesztése…" className="h-24" />
    {!draft.content ? <Text className="text-xs text-muted-foreground">Korábbi import időtartamát tartalom nélkül is bővítheted.</Text> : null}
  </View>;
}
function ImportRange({ draft, update, compact }: { draft: ImportDraft; update: (patch: Partial<ImportDraft>) => void; compact: boolean }) {
  return <View className="gap-3 rounded-xl border border-border bg-background/40 p-4"><View className="flex-row items-center gap-2"><Icon as={CalendarRange} size={18} className="text-primary" /><Text className="font-semibold">Importálási időszak</Text></View><View className={compact ? 'gap-3' : 'flex-row gap-3'}>
    <View className="min-w-0 flex-1 gap-1.5"><Text className="text-sm font-medium">Kezdete</Text><Input accessibilityLabel="Import kezdete (ÉÉÉÉ-HH-NN)" value={draft.from} onChangeText={from => update({ from })} placeholder="ÉÉÉÉ-HH-NN" /></View>
    <View className="min-w-0 flex-1 gap-1.5"><Text className="text-sm font-medium">Vége</Text><Input accessibilityLabel="Import vége (ÉÉÉÉ-HH-NN)" value={draft.to} onChangeText={to => update({ to })} placeholder="ÉÉÉÉ-HH-NN" /></View>
  </View></View>;
}
function DownloadFallback({ url, pick, report }: { url: string; pick: () => Promise<void>; report: (error: unknown) => void }) {
  async function download() { try { await Linking.openURL(calendarUrl(url)); } catch { report(new Error('Nem sikerült megnyitni a letöltést.')); } }
  return <View className="gap-2 rounded-lg border border-border p-3"><Text>A böngésző blokkolhatja a közvetlen importot. Töltsd le a naptárt, majd válaszd ki a fájlt.</Text>
    <Action secondary onPress={() => void download()}>1. Naptár letöltése</Action><Action secondary onPress={() => void pick()}>2. Letöltött ICS kiválasztása</Action>
  </View>;
}
