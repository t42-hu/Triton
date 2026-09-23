import { CalendarDays, Plus, Settings2, TriangleAlert, Upload, Users } from 'lucide-react-native';
import { Icon } from '@/components/ui/icon';
import { useEffect, useState } from 'react';
import { ScrollView, View, useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Text } from '@/components/ui/text';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import { useApp, type ViewState } from '@/features/app-state';
import { Action, Modal, Toggle } from '@/features/controls';
import { CalendarPanel } from '@/features/calendar-panel';
import { ProfilesDialog } from '@/features/profiles-dialog';
import { ImportDialog } from '@/features/import-dialog';
import { ManualDialog } from '@/features/manual-dialog';
import { SettingsDialog } from '@/features/settings-dialog';
import { EventDialog } from '@/features/event-dialog';
import { visibleEvents } from '@/data/repository';
import type { DisplayEvent } from '@/domain/model';
import { commonKeys } from '@/domain/comparison';
import { monday, today } from '@/domain/time';
import { CalendarSyncPanel } from '@/features/source-status';

type DialogName = 'profiles' | 'import' | 'manual' | 'settings' | null;
export default function TimetableScreen() {
  const app = useApp(); const { width } = useWindowDimensions();
  const [dialog, setDialog] = useState<DialogName>(null);
  const [addingCalendar, setAddingCalendar] = useState(false);
  const [event, setEvent] = useState<DisplayEvent>();
  const data = useCalendarData();
  const availableProfiles = app.profileList.filter(profile => profile.id !== data.ownId && !app.view.openProfiles.includes(profile.id));
  function addCalendar(profileId: number) {
    if (profileId === data.ownId) return;
    app.setView(current => current.openProfiles.includes(profileId) ? {} : { openProfiles: [...current.openProfiles, profileId], right: profileId, compare: true });
    setAddingCalendar(false);
  }
  function closeCalendar(profileId: number) {
    app.setView(current => closeOpenProfile(current, profileId, data.ownId));
  }
  return <SafeAreaView className="flex-1 bg-background"><ScrollView contentContainerStyle={{ padding: width < 600 ? 16 : 32, gap: 24, flexGrow: 1, width: '100%', maxWidth: 1600, alignSelf: 'center' }}>
    <View className="flex-row flex-wrap items-center justify-between gap-3 border-b border-border pb-5"><View className="flex-row items-center gap-3"><View className="h-11 w-11 items-center justify-center rounded-xl bg-primary"><Icon as={CalendarDays} size={23} className="text-primary-foreground" /></View><View><Text className="text-2xl font-semibold tracking-tight">Triton</Text><Text className="text-xs text-muted-foreground">Tervezd meg az egyetemi heted.</Text></View></View>
      <View className="flex-row gap-1"><Action quiet icon={Users} onPress={() => setDialog('profiles')}>Profilok</Action><Action quiet icon={Settings2} onPress={() => setDialog('settings')}>Beállítások</Action></View></View>
    {app.error ? <Alert icon={TriangleAlert} variant="destructive"><AlertTitle>Nem sikerült a művelet</AlertTitle><AlertDescription>{app.error}</AlertDescription></Alert> : null}
    <CalendarSyncPanel />
    {!app.profileList.length ? <EmptyState create={() => setDialog('profiles')} /> : <>
      <Toolbar open={setDialog} />
      <CalendarPanel side="left" date={data.ownDate} profileId={data.ownId} profileName={profileName(app.profileList, data.ownId)} events={data.ownEvents} common={data.ownCommon} selectEvent={setEvent} />
      {data.extras.map(extra => <CalendarPanel key={extra.id} side="right" date={extra.date} profileId={extra.id} profileName={profileName(app.profileList, extra.id)} events={extra.events} common={extra.common} selectEvent={setEvent} onClose={closeCalendar.bind(null, extra.id)} />)}
      {availableProfiles.length ? <View className="self-start"><Action secondary icon={Plus} onPress={() => setAddingCalendar(true)}>Órarend hozzáadása</Action></View> : null}
      <Text className="text-xs text-muted-foreground">Budapesti idő szerint. Az órarendjeid ezen az eszközön maradnak.</Text>
    </>}
    {addingCalendar ? <Modal title="Órarend hozzáadása" description="Válassz egy még meg nem nyitott órarendet." close={() => setAddingCalendar(false)}>{availableProfiles.map(profile => <Action key={profile.id} secondary onPress={() => addCalendar(profile.id)}>{profile.name}</Action>)}</Modal> : null}
    {dialog === 'profiles' ? <ProfilesDialog close={() => setDialog(null)} /> : null}
    {dialog === 'import' ? <ImportDialog profileId={data.ownId} close={() => setDialog(null)} /> : null}
    {dialog === 'manual' ? <ManualDialog profileId={data.ownId} close={() => setDialog(null)} /> : null}
    {dialog === 'settings' ? <SettingsDialog close={() => setDialog(null)} /> : null}
    {event ? <EventDialog event={event} close={() => setEvent(undefined)} /> : null}
  </ScrollView></SafeAreaView>;
}
function closeOpenProfile(current: ViewState, profileId: number, ownId: number): Partial<ViewState> {
  const openProfiles = current.openProfiles.filter(id => id !== profileId);
  return { openProfiles, right: openProfiles[0] ?? ownId, compare: openProfiles.length > 0 };
}
function profileName(profiles: { id: number; name: string }[], id: number): string {
  return profiles.find(profile => profile.id === id)?.name ?? '';
}
function useCalendarData() {
  const { view, profileList, version, setError } = useApp();
  const [eventsById, setEventsById] = useState<Record<number, DisplayEvent[]>>({});
  const ownId = profileList.find(profile => profile.isOwn)?.id ?? profileList[0]?.id ?? 0;
  const ownDate = view.mode === 'week' ? monday(view.leftDate) : view.leftDate;
  const extraDate = view.mode === 'week' ? monday(view.rightDate) : view.rightDate;
  const days = view.mode === 'week' ? 7 : 1;
  useEffect(() => {
    let canceled = false;
    async function load() {
      async function loadProfile(id: number): Promise<[number, DisplayEvent[]]> {
        return [id, await visibleEvents(id, id === ownId ? ownDate : extraDate, days, view.hidden)];
      }
      const entries = await Promise.all([ownId, ...view.openProfiles].map(loadProfile));
      if (!canceled) setEventsById(Object.fromEntries(entries));
    }
    function failed(error: unknown) { if (!canceled) setError(String(error)); }
    void load().catch(failed);
    return () => { canceled = true; };
  }, [ownId, ownDate, extraDate, days, version, view.hidden, view.openProfiles, setError]);
  const ownEvents = eventsById[ownId] ?? [];
  const extras = view.openProfiles.map(id => ({ id, date: extraDate, events: eventsById[id] ?? [], common: commonKeys(eventsById[id] ?? [], ownEvents) }));
  const ownCommon = new Set(extras.flatMap(extra => [...commonKeys(ownEvents, extra.events)]));
  return { ownId, ownDate, ownEvents, ownCommon, extras };
}
const toolbarControlSize = { width: 132, height: 44 };
function Toolbar({ open }: { open: (dialog: DialogName) => void }) {
  const { view, setView } = useApp();
  return <View className="gap-3"><View className="flex-row flex-wrap items-center justify-between gap-3">
    <View className="flex-row flex-wrap items-center gap-2"><Tabs value={view.mode} onValueChange={mode => setView({ mode: mode === 'day' ? 'day' : 'week' })}><TabsList style={toolbarControlSize}><TabsTrigger className="min-w-0 flex-1" value="day"><Text>Nap</Text></TabsTrigger><TabsTrigger className="min-w-0 flex-1" value="week"><Text>Hét</Text></TabsTrigger></TabsList></Tabs>
      <Action secondary onPress={() => setView({ leftDate: today(), rightDate: today() })}>Ma</Action><Action secondary label="Kicsinyítés" onPress={() => setView({ zoom: Math.max(0.5, view.zoom - 0.25) })}>−</Action><Badge variant="outline"><Text>{Math.round(view.zoom * 100)}%</Text></Badge><Action secondary label="Nagyítás" onPress={() => setView({ zoom: Math.min(2.5, view.zoom + 0.25) })}>+</Action></View>
    <View className="flex-row gap-2"><Button accessibilityLabel="Importálás" variant="outline" style={toolbarControlSize} className="px-2" onPress={() => open('import')}><Icon as={Upload} size={17} className="text-foreground" /><Text>Importálás</Text></Button><Action icon={Plus} onPress={() => open('manual')}>Új óra</Action></View>
  </View><View className="flex-row flex-wrap gap-5 pt-2">
    {view.openProfiles.length ? <><Toggle label="Szinkronlapozás" checked={view.sync} onChange={sync => setView({ sync, ...(sync ? { rightDate: view.leftDate } : {}) })} /><Toggle label="Csak közös órák" checked={view.common} onChange={common => setView({ common })} /></> : null}
  </View></View>;
}
function EmptyState({ create }: { create: () => void }) {
  return <View className="min-h-96 justify-center gap-5 px-3 py-12 sm:px-12">
    <Icon as={CalendarDays} size={40} strokeWidth={1.3} className="text-primary" />
    <Text className="text-3xl font-semibold tracking-tight">Itt kezdődik a heted.</Text><Text className="max-w-md text-base leading-7 text-muted-foreground">Hozz létre egy profilt, majd töltsd be az órarendedet. Az órák, termek és közös alkalmak egy helyen lesznek.</Text><View className="self-start"><Action icon={Plus} onPress={create}>Első profil létrehozása</Action></View>
  </View>;
}
