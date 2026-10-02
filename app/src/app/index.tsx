import { MapPinned, Plus, RefreshCw, Settings2, TriangleAlert, Users } from 'lucide-react-native';
import { PanelViewportProvider, usePanelViewport } from '@/features/panel-viewport';
import { Icon } from '@/components/ui/icon';
import { Image } from 'expo-image';
import { useEffect, useRef, useState } from 'react';
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
import { RoomMapDialog } from '@/features/room-map-dialog';
import { visibleEvents } from '@/data/repository';
import type { DisplayEvent, EventCategory } from '@/domain/model';
import { commonKeys } from '@/domain/comparison';
import { monday } from '@/domain/time';
import { useCalendarSync } from '@/features/use-calendar-sync';
import { CalendarSyncPanel, useSourceStatus } from '@/features/source-status';
import { TimetableToolbar } from '@/features/timetable-toolbar';
import { openProfile } from '@/features/view-state';
import { ReminderBell } from '@/features/reminder-bell';
import { StudentNavigation, StudentWorkspace, type WorkspaceScreen } from '@/features/student-workspace';
import { NotebookDialog } from '@/features/notebook-dialog';
import { hasMappedRoom } from '@/features/room-location';
import { lessonRooms } from '@/data/student-repository';

type DialogName = 'profiles' | 'import' | 'manual' | 'settings' | 'reminders' | 'map' | 'menu' | 'sync' | null;
export default function TimetableScreen() {
  return <PanelViewportProvider><TimetableWorkspace /></PanelViewportProvider>;
}
function TimetableWorkspace() {
  const app = useApp(); const { width } = useWindowDimensions(); const screenScroll = useRef<ScrollView>(null);
  const [screen, setScreen] = useState<WorkspaceScreen>('today');
  const [dialog, setDialog] = useState<DialogName>(null); const [importProfileId, setImportProfileId] = useState<number>(); const [addingCalendar, setAddingCalendar] = useState(false);
  const [event, setEvent] = useState<DisplayEvent>(); const [notebook, setNotebook] = useState<DisplayEvent>(); const [manualCategory, setManualCategory] = useState<EventCategory>('lesson');
  const { mapRequest, openRoomMap, closeRoomMap, isMapOpen } = useRoomMap(dialog, setDialog);
  const syncState = useCalendarSync();
  const data = useCalendarData(); const showMap = useMapAvailability(data.ownId);
  const { addCalendar } = calendarActions(app, data.ownId, setAddingCalendar);
  const availableProfiles = app.profileList.filter(profile => profile.id !== data.ownId && !app.view.openProfiles.includes(profile.id));
  function openNew(category: EventCategory) { setManualCategory(category); setDialog('manual'); }
  function openDialog(name: DialogName) { if (name === 'manual') setManualCategory('lesson'); setDialog(name); }
  function navigate(next: WorkspaceScreen) { setScreen(next); screenScroll.current?.scrollTo({ y: 0, animated: false }); }
  return <SafeAreaView className="flex-1 bg-background"><WorkspaceHeader create={() => openNew('lesson')} />{width >= 600 ? <StudentNavigation screen={screen} navigate={navigate} openMenu={() => setDialog('menu')} menuOpen={dialog === 'menu'} /> : null}<ScrollView ref={screenScroll} nestedScrollEnabled directionalLockEnabled keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: width < 600 ? 16 : 32, gap: 24, flexGrow: 1, width: '100%', maxWidth: 1600, alignSelf: 'center' }}>

    {app.error ? <Alert icon={TriangleAlert} variant="destructive"><AlertTitle>Nem sikerült a művelet</AlertTitle><AlertDescription>{app.error}</AlertDescription></Alert> : null}
    {!app.profileList.length ? <EmptyState create={() => setDialog('profiles')} /> : <StudentWorkspace key={data.ownId} profileId={data.ownId} openEvent={setEvent} openNotebook={setNotebook} openNew={openNew} openMap={openRoomMap} screen={screen} openTasks={() => navigate('tasks')} calendar={<CalendarWorkspace data={data} selectEvent={setEvent} selectNotebook={setNotebook} addCalendar={() => setAddingCalendar(true)} />} />}
    {addingCalendar ? <Modal title="Órarend hozzáadása" description="Válassz egy még meg nem nyitott órarendet." close={() => setAddingCalendar(false)}>{availableProfiles.map(profile => <Action key={profile.id} secondary onPress={() => addCalendar(profile.id)}>{profile.name}</Action>)}</Modal> : null}
    {dialog === 'profiles' ? <ProfilesDialog close={() => setDialog(null)} onCreated={id => { setImportProfileId(id); setDialog('import'); }} onImport={id => { setImportProfileId(id); setDialog('import'); }} /> : null}
    {dialog === 'import' ? <ImportDialog profileId={importProfileId ?? data.ownId} close={() => { setImportProfileId(undefined); setDialog(null); }} /> : null}
    {dialog === 'manual' ? <ManualDialog profileId={data.ownId} initialCategory={manualCategory} close={() => setDialog(null)} openMap={openRoomMap} /> : null}
    {dialog === 'menu' ? <WorkspaceMenu showMap={showMap} open={openDialog} close={() => setDialog(null)} /> : null}
    {dialog === 'sync' ? <Modal title="Naptárszinkronizálás" close={() => setDialog(null)}><CalendarSyncPanel syncState={syncState} onDisconnected={() => setDialog(null)} /></Modal> : null}
    {dialog === 'settings' ? <SettingsDialog close={() => setDialog(null)} /> : null}
    {dialog === 'reminders' ? <ReminderDialog close={() => setDialog(null)} /> : null}
    {event ? <EventDialog event={event} close={() => setEvent(undefined)} openMap={openRoomMap} /> : null}
    {notebook ? <NotebookDialog event={notebook} close={() => setNotebook(undefined)} /> : null}
    {(showMap && Platform.OS === 'ios') || isMapOpen ? <RoomMapDialog location={mapRequest?.location ?? ''} close={closeRoomMap} open={isMapOpen} /> : null}
  </ScrollView>{width < 600 && app.profileList.length ? <StudentNavigation screen={screen} navigate={navigate} openMenu={() => setDialog('menu')} menuOpen={dialog === 'menu'} /> : null}</SafeAreaView>;
}
function CalendarWorkspace({ data, selectEvent, selectNotebook, addCalendar }: { data: ReturnType<typeof useCalendarData>; selectEvent: (event: DisplayEvent) => void; selectNotebook: (event: DisplayEvent) => void; addCalendar: () => void }) {
  const app = useApp(); const { width } = useWindowDimensions();
  const contentWidth = Math.min(width, 1600) - (width < 600 ? 32 : 64); const sideBySide = app.view.arrangement === 'row' && data.extras.length > 0;
  const nativeRow = sideBySide && Platform.OS !== 'web'; const panelWidth = sideBySide ? Math.max(nativeRow && app.view.mode === 'week' ? 1092 : 320, (contentWidth - 24) / 2) : contentWidth;
  const { closeCalendar } = calendarActions(app, data.ownId, () => undefined);
  const panels = <><CalendarPanel side="left" date={data.ownDate} profileId={data.ownId} profileName={profileName(app.profileList, data.ownId)} panelWidth={panelWidth} outerHorizontalScroll={nativeRow} events={data.ownEvents} common={data.ownCommon} selectEvent={selectEvent} selectNotebook={selectNotebook} />{data.extras.map(extra => <CalendarPanel key={extra.id} side="right" date={extra.date} profileId={extra.id} profileName={profileName(app.profileList, extra.id)} panelWidth={panelWidth} outerHorizontalScroll={nativeRow} events={extra.events} common={extra.common} selectEvent={selectEvent} selectNotebook={selectNotebook} onClose={closeCalendar.bind(null, extra.id)} />)}</>;
  return <View className="gap-5"><TimetableToolbar />{sideBySide ? <ScrollView horizontal nestedScrollEnabled directionalLockEnabled contentContainerStyle={{ gap: 24 }}>{panels}</ScrollView> : <View className="gap-6">{panels}</View>}{app.profileList.length > app.view.openProfiles.length + 1 ? <View className="self-start"><Action secondary icon={Plus} onPress={addCalendar}>Órarend hozzáadása</Action></View> : null}</View>;
}
function useMapAvailability(profileId: number) {
  const { version } = useApp(); const [showMap, setShowMap] = useState(false);
  useEffect(() => {
    let cancelled = false;
    async function load() { try { const rooms = await lessonRooms(profileId); if (!cancelled) setShowMap(rooms.some(hasMappedRoom)); } catch { if (!cancelled) setShowMap(false); } }
    void load(); return () => { cancelled = true; };
  }, [profileId, version]);
  return showMap;
}
function calendarActions(app: ReturnType<typeof useApp>, ownId: number, setAddingCalendar: (value: boolean) => void) {
  function addCalendar(profileId: number) {
    if (profileId === ownId) return;
    app.setView(current => openProfile(current, profileId));
    setAddingCalendar(false);
  }
  function closeCalendar(profileId: number) { app.setView(current => closeOpenProfile(current, profileId, ownId)); }
  return { addCalendar, closeCalendar };
}
function useRoomMap(dialog: DialogName, setDialog: (value: DialogName) => void) {
  const [mapRequest, setMapRequest] = useState<{ location: string; onClose: () => void } | null>(null);
  function openRoomMap(location: string, onClose: () => void) { setMapRequest({ location, onClose }); }
  function closeRoomMap() { mapRequest?.onClose(); setMapRequest(null); if (dialog === 'map') setDialog(null); }
  return { mapRequest, openRoomMap, closeRoomMap, isMapOpen: dialog === 'map' || mapRequest !== null };
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

function WorkspaceHeader({ create }: { create: () => void }) {
  const { measureHeader } = usePanelViewport();
  return <View onLayout={measureHeader} className="border-b border-border px-4 py-3 sm:px-8">
    <View className="flex-row items-center justify-between gap-3"><View className="flex-row items-center gap-2"><Image source={require('@/assets/images/triton-v15.png')} accessibilityLabel="Triton logó" contentFit="contain" style={{ width: 44, height: 44 }} /><Text className="text-xl font-semibold">Triton</Text></View><Button accessibilityLabel="Új óra / esemény" className="h-10 gap-1.5 rounded-lg px-3" onPress={create}><Icon as={Plus} size={17} className="text-primary-foreground" /><Text className="text-[12px]">Új óra / esemény</Text></Button></View>
  </View>;
}
function WorkspaceMenu({ showMap, open, close }: { showMap: boolean; open: (dialog: DialogName) => void; close: () => void }) {
  const { remindersEnabled, profileList } = useApp();
  const source = useSourceStatus(profileList.find(profile => profile.isOwn)?.id ?? 0);
  return <Modal title="Menü" close={close}>
    <Button accessibilityLabel="Profilok" variant="ghost" className="justify-start border-0 bg-transparent" onPress={() => open('profiles')}><Icon as={Users} size={19} /><Text>Profilok</Text></Button>
    {Platform.OS !== 'web' ? <Button accessibilityLabel="Értesítések" variant="ghost" className="justify-start border-0 bg-transparent" onPress={() => open('reminders')}><ReminderBell enabled={remindersEnabled} size={19} /><Text>Értesítések</Text></Button> : null}
    <Button accessibilityLabel="Beállítások" variant="ghost" className="justify-start border-0 bg-transparent" onPress={() => open('settings')}><Icon as={Settings2} size={19} /><Text>Beállítások</Text></Button>
    {showMap ? <Button accessibilityLabel="Térkép" variant="ghost" className="justify-start border-0 bg-transparent" onPress={() => open('map')}><Icon as={MapPinned} size={19} /><Text>Térkép</Text></Button> : null}
    {source?.url && Platform.OS !== 'web' ? <Button accessibilityLabel="Naptárszinkronizálás" variant="ghost" className="justify-start border-0 bg-transparent" onPress={() => open('sync')}><Icon as={RefreshCw} size={19} /><Text>Naptárszinkronizálás</Text></Button> : null}
  </Modal>;
}
