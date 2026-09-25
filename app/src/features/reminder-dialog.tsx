import { useEffect, useState } from 'react';
import { Platform, View } from 'react-native';
import { BellRing, Check, Plus, Trash2 } from 'lucide-react-native';
import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Text } from '@/components/ui/text';
import type { DisplayEvent } from '../domain/model';
import { DEFAULT_REMINDERS, REMINDER_PROFILES, validateReminderRules, type ReminderProfile, type ReminderRule } from '../domain/reminders';
import { eventReminders, globalReminders, saveEventReminders, saveGlobalReminders } from '../data/reminders';
import { readSetting } from '../data/database';
import { openExactAlarmSettings, openReminderChannel, reconcileReminders, requestReminderPermission } from '../data/reminder-runtime';
import { wallTime } from '../domain/time';
import { useApp } from './app-state';
import { Action, Choice, Modal, Toggle } from './controls';

type DraftRule = { minutes: string; profile: ReminderProfile };
type ReminderStatus = { count: number; through: number; error: string };
const emptyStatus: ReminderStatus = { count: 0, through: 0, error: '' };

/** Edits one occurrence, or the global rules of the currently designated own profile. */
export function ReminderDialog({ event, close }: { event?: DisplayEvent; close: () => void }) {
  const app = useApp();
  const state = useReminderForm(event);
  const isOwn = app.profileList.some(profile => profile.id === event?.profileId && profile.isOwn);
  async function save() {
    state.setBusy(true); state.setMessage('');
    try {
      const rules = state.rules.map(rule => ({ minutes: Number(rule.minutes), profile: rule.profile })); validateReminderRules(rules);
      if (rules.length && (event || state.enabled) && Platform.OS !== 'web') await requestReminderPermission();
      if (event) await saveEventReminders(event, { excludeGlobal: state.excluded, rules });
      else await saveGlobalReminders({ enabled: state.enabled, rules });
      state.setMessage('Mentve.'); await reconcileReminders(); await app.refresh(); state.setStatus(await readSetting('reminderStatus', emptyStatus));
    } catch (error) { state.setMessage(`Nem sikerült minden lépés: ${error instanceof Error ? error.message : String(error)}`); }
    finally { state.setBusy(false); }
  }
  return <Modal title={event ? 'Alkalom értesítései' : 'Óra előtti értesítések'} description={event ? `${event.title} · ${wallTime(event.start).slice(0, 16)}` : 'Jelzések a sajátként kijelölt órarendhez.'} close={close}>
    {event ? <Text className="text-sm text-muted-foreground">Egyszeri jelzések erre az alkalomra, a mentett kezdés előtt. A sorozat többi óráját nem módosítják. Azonos előjelzési időnél az itteni profil váltja fel a globálisat.</Text> : <View className="flex-row items-center gap-3 rounded-xl border border-border bg-background/40 p-3"><View className="h-10 w-10 items-center justify-center rounded-xl bg-muted"><Icon as={BellRing} size={19} className="text-primary" /></View><View className="min-w-0 flex-1"><Text className="font-semibold">Globális jelzések</Text><Text className="text-xs text-muted-foreground">A saját órarended óráihoz</Text></View><Switch accessibilityLabel="Globális óra előtti jelzések" checked={state.enabled} onCheckedChange={state.setEnabled} /></View>}
    {event && isOwn ? <Toggle label="Globális jelzések kizárása erre az alkalomra" checked={state.excluded} onChange={state.setExcluded} /> : null}
    {event && !isOwn ? <Text className="text-sm text-muted-foreground">Szaktársi órarend: csak az itt felvett jelzések érvényesek.</Text> : null}
    <RuleEditor rules={state.rules} onChange={state.setRules} />
    <Button accessibilityLabel="Értesítések mentése" disabled={!state.ready || state.busy} onPress={() => void save()}><Icon as={Check} size={17} className="text-primary-foreground" /><Text>{state.busy ? 'Mentés…' : 'Értesítések mentése'}</Text></Button>
    <Text className="text-xs text-muted-foreground">1–10080 perc (legfeljebb 7 nap). A múltbeli jelzések nem érkeznek meg; egész napos eseménynél a kezdés budapesti éjfél.</Text>
    {state.message ? <Text accessibilityLiveRegion="polite">{state.message}</Text> : null}
    <ReminderDelivery status={state.status} report={state.setMessage} />
  </Modal>;
}
function useReminderForm(event?: DisplayEvent) {
  const [rules, setRules] = useState<DraftRule[]>([]);
  const [enabled, setEnabled] = useState(false); const [excluded, setExcluded] = useState(false);
  const [ready, setReady] = useState(false); const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState(''); const [status, setStatus] = useState(emptyStatus);
  useEffect(() => {
    let disposed = false;
    async function load() {
      try {
        const global = await globalReminders(); const local = event ? await eventReminders(event) : null;
        const delivery = await readSetting('reminderStatus', emptyStatus);
        if (disposed) return;
        setRules((local?.rules ?? global.rules).map(toDraft)); setEnabled(global.enabled); setExcluded(local?.excludeGlobal ?? false); setStatus(delivery); setReady(true);
      } catch { if (!disposed) setMessage('Nem sikerült betölteni az értesítéseket. Nyisd meg újra az ablakot.'); }
    }
    void load(); return () => { disposed = true; };
  }, [event]);
  return { rules, setRules, enabled, setEnabled, excluded, setExcluded, ready, busy, setBusy, message, setMessage, status, setStatus };
}
function toDraft(rule: ReminderRule): DraftRule { return { ...rule, minutes: String(rule.minutes) }; }
function RuleEditor({ rules, onChange }: { rules: DraftRule[]; onChange: (rules: DraftRule[]) => void }) {
  function update(index: number, patch: Partial<DraftRule>) { onChange(rules.map((rule, position) => position === index ? { ...rule, ...patch } : rule)); }
  function remove(index: number) { onChange(rules.filter((_, position) => position !== index)); }
  return <View className="gap-3">
    <View className="overflow-hidden rounded-xl border border-border bg-background/40">{rules.map((rule, index) => <View key={index} className="gap-2 border-b border-border p-3 last:border-b-0">
      <View className="flex-row items-center justify-between"><View className="flex-row items-center gap-2"><View className="h-7 w-7 items-center justify-center rounded-lg bg-muted"><Text className="text-xs font-semibold text-primary">{index + 1}</Text></View><Text className="text-sm font-semibold">Jelzés</Text></View><Button accessibilityLabel={`${index + 1}. jelzés törlése`} variant="ghost" className="h-9 w-9 rounded-lg border-0 bg-transparent p-0" onPress={() => remove(index)}><Icon as={Trash2} size={17} className="text-destructive" /></Button></View>
      <View className="flex-row gap-3"><View className="min-w-0 flex-1 gap-1"><Text className="text-xs text-muted-foreground">Idő (perc)</Text><Input accessibilityLabel={`${index + 1}. jelzés · perccel kezdés előtt`} keyboardType="number-pad" value={rule.minutes} onChangeText={minutes => update(index, { minutes })} /></View><View className="min-w-0 flex-1 gap-1"><Text className="text-xs text-muted-foreground">Jelzésmód</Text><Choice fullWidth label={`${index + 1}. jelzés · jelzőprofil`} value={rule.profile} options={REMINDER_PROFILES.map(profile => ({ value: profile.value, label: profile.label }))} onChange={value => update(index, { profile: value as ReminderProfile })} /></View></View>
    </View>)}</View>
    <Button accessibilityLabel="Előjelzés hozzáadása" variant="outline" disabled={rules.length >= 20} onPress={() => onChange([...rules, { minutes: '', profile: 'standard' }])}><Icon as={Plus} size={17} /><Text>Jelzés hozzáadása</Text></Button>
    {!rules.length ? <Action secondary onPress={() => onChange(DEFAULT_REMINDERS.rules.map(toDraft))}>60 / 20 / 5 perces minta</Action> : null}
  </View>;
}
function ReminderDelivery({ status, report }: { status: ReminderStatus; report: (message: string) => void }) {
  async function open(profile: ReminderProfile) { try { await openReminderChannel(profile); } catch { report('A rendszerbeállításokat nem sikerült megnyitni.'); } }
  async function exactAlarms() { try { await openExactAlarmSettings(); } catch { report('Nyisd meg az Android Beállítások → Ébresztések és emlékeztetők menüt.'); } }
  if (Platform.OS === 'web') return <Text className="text-sm text-muted-foreground">Weben csak helyi beállításokat tárolunk, értesítést a mobilapp küld. Nincs eszközök közötti szinkron.</Text>;
  return <View className="gap-2">
    <Text className="text-sm">{status.count} jelzés ütemezve{status.through ? ` · utolsó: ${wallTime(status.through).slice(0, 16)}` : ''}.</Text>
    {status.error ? <Text accessibilityRole="alert" className="text-destructive">{status.error}</Text> : null}
    <Text className="text-xs text-muted-foreground">A következő 30 napból legfeljebb 60 jelzést készítünk elő. Megnyitáskor és engedélyezett háttérfutáskor bővül a sor. Hosszabb távhoz nyisd meg rendszeresen az appot; az akkukímélés és rendszerengedélyek késleltethetik a kézbesítést.</Text>
    {Platform.OS === 'android' ? <><Action secondary onPress={() => void exactAlarms()}>Pontos jelzések engedélyezése</Action><Text className="text-sm">Jelzőprofilok: egy, két vagy három rezgés. A hang és a rendszer által támogatott rezgésopciók külön állíthatók.</Text>{REMINDER_PROFILES.map(profile => <Action key={profile.value} secondary onPress={() => void open(profile.value)}>{`${profile.label} · rendszerbeállítások`}</Action>)}</> : <Text className="text-xs text-muted-foreground">iOS-en a három profil közös rendszerhangot használ; az Android csatornánkénti rezgésbeállításai itt nem érhetők el.</Text>}
  </View>;
}
