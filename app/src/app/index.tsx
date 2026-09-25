import { Bell, Plus, Settings2, TriangleAlert, Users } from 'lucide-react-native';
import { Icon } from '@/components/ui/icon';
import { Image } from 'expo-image';
import { useEffect, useState } from 'react';
import { Platform, ScrollView, View, useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Text } from '@/components/ui/text';
import { Button } from '@/components/ui/button';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import { useApp, type ViewState } from '@/features/app-state';
import { Action, Modal } from '@/features/controls';
import { CalendarPanel } from '@/features/calendar-panel';
import { ProfilesDialog } from '@/features/profiles-dialog';
import { ImportDialog } from '@/features/import-dialog';
import { ManualDialog } from '@/features/manual-dialog';
import { SettingsDialog } from '@/features/settings-dialog';
import { ReminderDialog } from '@/features/reminder-dialog';
import { EventDialog } from '@/features/event-dialog';
import { visibleEvents } from '@/data/repository';
import type { DisplayEvent } from '@/domain/model';
import { commonKeys } from '@/domain/comparison';
import { monday } from '@/domain/time';
import { CalendarSyncPanel } from '@/features/source-status';
import { TimetableToolbar } from '@/features/timetable-toolbar';
import { openProfile } from '@/features/view-state';

type DialogName = 'profiles' | 'import' | 'manual' | 'settings' | 'reminders' | null;
export default function TimetableScreen() {
  const app = useApp(); const { width } = useWindowDimensions();
  const [dialog, setDialog] = useState<DialogName>(null);
  const [importProfileId, setImportProfileId] = useState<number>();
  const [addingCalendar, setAddingCalendar] = useState(false);
  const [event, setEvent] = useState<DisplayEvent>();
  const data = useCalendarData();
  const contentWidth = Math.min(width, 1600) - (width < 600 ? 32 : 64); const sideBySide = app.view.arrangement === 'row' && data.extras.length > 0;
  const nativeRow = sideBySide && Platform.OS !== 'web';
  const panelWidth = sideBySide ? Math.max(nativeRow && app.view.mode === 'week' ? 780 : 320, (contentWidth - 24) / 2) : contentWidth;
  const panels = <>
    <CalendarPanel side="left" date={data.ownDate} profileId={data.ownId} profileName={profileName(app.profileList, data.ownId)} panelWidth={panelWidth} outerHorizontalScroll={nativeRow} events={data.ownEvents} common={data.ownCommon} selectEvent={setEvent} />
    {data.extras.map(extra => <CalendarPanel key={extra.id} side="right" date={extra.date} profileId={extra.id} profileName={profileName(app.profileList, extra.id)} panelWidth={panelWidth} outerHorizontalScroll={nativeRow} events={extra.events} common={extra.common} selectEvent={setEvent} onClose={closeCalendar.bind(null, extra.id)} />)}
  </>;
  const availableProfiles = app.profileList.filter(profile => profile.id !== data.ownId && !app.view.openProfiles.includes(profile.id));
  function addCalendar(profileId: number) {
    if (profileId === data.ownId) return;
    app.setView(current => openProfile(current, profileId));
    setAddingCalendar(false);
  }
  function closeCalendar(profileId: number) { app.setView(current => closeOpenProfile(current, profileId, data.ownId)); }
  return <SafeAreaView className="flex-1 bg-background"><ScrollView contentContainerStyle={{ padding: width < 600 ? 16 : 32, gap: 24, flexGrow: 1, width: '100%', maxWidth: 1600, alignSelf: 'center' }}>
    <View className="flex-row flex-wrap items-center justify-between gap-3 border-b border-border pb-5"><View className="flex-row items-center gap-2"><Image source={require('@/assets/images/triton-v15.png')} accessibilityLabel="Triton logó" contentFit="contain" style={{ width: width < 600 ? 38 : 56, height: width < 600 ? 38 : 56 }} /><View className={width < 600 ? 'h-7 w-px bg-border' : 'h-9 w-px bg-border'} /><Text className={`${width < 600 ? 'text-xl' : 'text-2xl'} font-semibold tracking-tight`}>Triton</Text></View>
      <HeaderActions compact={width < 600} open={setDialog} /></View>
    {app.error ? <Alert icon={TriangleAlert} variant="destructive"><AlertTitle>Nem sikerült a művelet</AlertTitle><AlertDescription>{app.error}</AlertDescription></Alert> : null}
    <CalendarSyncPanel />
    {!app.profileList.length ? <EmptyState create={() => setDialog('profiles')} /> : <>
      <TimetableToolbar open={setDialog} />
      {sideBySide ? <ScrollView horizontal contentContainerStyle={{ gap: 24 }}>{panels}</ScrollView> : <View className="gap-6">{panels}</View>}
      {availableProfiles.length ? <View className="self-start"><Action secondary icon={Plus} onPress={() => setAddingCalendar(true)}>Órarend hozzáadása</Action></View> : null}
      <Text className="text-xs text-muted-foreground">Budapesti idő szerint. Az órarendjeid ezen az eszközön maradnak.</Text>
    </>}
    {addingCalendar ? <Modal title="Órarend hozzáadása" description="Válassz egy még meg nem nyitott órarendet." close={() => setAddingCalendar(false)}>{availableProfiles.map(profile => <Action key={profile.id} secondary onPress={() => addCalendar(profile.id)}>{profile.name}</Action>)}</Modal> : null}
    {dialog === 'profiles' ? <ProfilesDialog close={() => setDialog(null)} onCreated={id => { setImportProfileId(id); setDialog('import'); }} /> : null}
    {dialog === 'import' ? <ImportDialog profileId={importProfileId ?? data.ownId} close={() => { setImportProfileId(undefined); setDialog(null); }} /> : null}
    {dialog === 'manual' ? <ManualDialog profileId={data.ownId} close={() => setDialog(null)} /> : null}
    {dialog === 'settings' ? <SettingsDialog close={() => setDialog(null)} /> : null}{dialog === 'reminders' ? <ReminderDialog close={() => setDialog(null)} /> : null}
    {event ? <EventDialog event={event} close={() => setEvent(undefined)} /> : null}
  </ScrollView></SafeAreaView>;
}
function HeaderActions({ compact, open }: { compact: boolean; open: (dialog: DialogName) => void }) {
  const buttonStyle = compact ? { width: 44, height: 44 } : undefined;
  return <View className="flex-row gap-1">
    <Button accessibilityLabel="Profilok" variant="ghost" size={compact ? 'icon' : 'default'} style={buttonStyle} onPress={() => open('profiles')}><Icon as={Users} size={17} className="text-foreground" />{compact ? null : <Text>Profilok</Text>}</Button>
    <Button accessibilityLabel="Értesítések" variant="ghost" size={compact ? 'icon' : 'default'} style={buttonStyle} onPress={() => open('reminders')}><Icon as={Bell} size={17} className="text-foreground" />{compact ? null : <Text>Értesítések</Text>}</Button>
    <Button accessibilityLabel="Beállítások" variant="ghost" size={compact ? 'icon' : 'default'} style={buttonStyle} onPress={() => open('settings')}><Icon as={Settings2} size={17} className="text-foreground" />{compact ? null : <Text>Beállítások</Text>}</Button>
  </View>;
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
function EmptyState({ create }: { create: () => void }) {
  return <View className="min-h-96 justify-center gap-5 px-3 py-12 sm:px-12">
    <Image source={require('@/assets/images/triton-v15.png')} accessibilityLabel="Triton logó" contentFit="contain" style={{ width: 72, height: 72 }} />
    <Text className="text-3xl font-semibold tracking-tight">Itt kezdődik a heted.</Text><Text className="max-w-md text-base leading-7 text-muted-foreground">Hozz létre egy profilt, majd töltsd be az órarendedet. Az órák, termek és közös alkalmak egy helyen lesznek.</Text><View className="self-start"><Action icon={Plus} onPress={create}>Első profil létrehozása</Action></View>
  </View>;
}
