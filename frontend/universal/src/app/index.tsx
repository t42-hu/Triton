import { BrandWordmark } from '@/components/brand-wordmark';
import { LinksDialog } from '@/features/links-dialog';
import { AccountDialog } from '@/features/account-dialog';
import { router } from 'expo-router';
import { usePanelScrollController } from '@/features/panel-scroll';
import { MapPinned, Link2, Plus, RefreshCw, Settings2, TriangleAlert, Users, UsersRound, Ellipsis, Bell, Clock3, ChevronRight, type LucideIcon } from 'lucide-react-native';
import { PanelViewportProvider, usePanelViewport } from '@/features/panel-viewport';
import { Icon } from '@/components/ui/icon';
import { Image } from 'expo-image';
import { useWorkspaceNavigation } from '@/features/workspace-navigation';
import { NavigationSwipe } from '@/features/navigation-swipe';
import { WorkspaceScroll } from '@/features/workspace-scroll';
import { WorkspacePages } from '@/features/workspace-pages';
import { useEffect, useRef, useState } from 'react';
import { Platform, ScrollView, View, useWindowDimensions, type LayoutChangeEvent } from 'react-native';
import { WorkspaceFrame } from '@/features/workspace-frame';
import { WorkspaceSetupGate } from '@/features/workspace-setup-gate';
import { Text } from '@/components/ui/text';
import { Button } from '@/components/ui/button';
import { AlertDialog, AlertDialogAction, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogTitle } from '@/components/ui/alert-dialog';
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
import { monday, today } from '@/domain/time';
import { useCalendarSync } from '@/features/use-calendar-sync';
import { CalendarSyncPanel, useSourceStatus } from '@/features/source-status';
import { TimetableToolbar } from '@/features/timetable-toolbar';
import { openProfile } from '@/features/view-state';
import { StudentNavigation, StudentWorkspace, type WorkspaceScreen } from '@/features/student-workspace';
import { NotebookDialog } from '@/features/notebook-dialog';
import { hasMappedRoom } from '@/features/room-location';
import { lessonRooms } from '@/data/student-repository';
import { WorkspaceHeading } from '@/features/workspace-section';
import { FreeTimeDialog } from '@/features/free-time-dialog';

type DialogName = 'links' | 'account' | 'profiles' | 'import' | 'manual' | 'settings' | 'reminders' | 'map' | 'menu' | 'sync' | null;
export default function TimetableScreen() {
  return <PanelViewportProvider><WorkspaceSetupGate><TimetableWorkspace /></WorkspaceSetupGate></PanelViewportProvider>;
}
function TimetableWorkspace() {
  const app = useApp(); const { width } = useWindowDimensions(); const { scroll } = usePanelScrollController();
  const hasBottomNavigation = Platform.OS === 'web' ? width < 960 : width < 600;
  const showBottomNavigation = hasBottomNavigation && (Platform.OS === 'web' || app.profileList.length > 0);
  const { screen, navigate: changeScreen } = useWorkspaceNavigation();
  const [dialog, setDialog] = useState<DialogName>(null); const [importProfileId, setImportProfileId] = useState<number>(); const [addingCalendar, setAddingCalendar] = useState(false);
  const [event, setEvent] = useState<DisplayEvent>(); const [notebook, setNotebook] = useState<DisplayEvent>(); const [manualCategory, setManualCategory] = useState<EventCategory>('lesson');
  const { mapRequest, openRoomMap, closeRoomMap, isMapOpen } = useRoomMap(dialog, setDialog);
  const syncState = useCalendarSync();
  useEffect(() => { if (app.calendarImport) router.setParams({ workspace: 'calendar' }); }, [app.calendarImport]);
  const data = useCalendarData(); const showMap = useMapAvailability(data.ownId);
  const { addCalendar } = calendarActions(app, data.ownId, setAddingCalendar);
  const availableProfiles = app.profileList.filter(profile => profile.id !== data.ownId && !app.view.openProfiles.includes(profile.id));
  function openNew(category: EventCategory) { setManualCategory(category); setDialog('manual'); }
  function openDialog(name: DialogName) { if (name === 'manual') setManualCategory('lesson'); setDialog(name); }
  function navigate(next: WorkspaceScreen) { changeScreen(next); scroll.current?.scrollTo({ y: 0, animated: false }); }
  return <WorkspaceFrame screen={screen} navigate={navigate} create={() => openNew('lesson')} openAccount={() => setDialog('account')} openProfiles={() => setDialog('profiles')} openLinks={() => setDialog('links')} openSettings={() => setDialog('settings')} openMap={() => setDialog('map')} showMap={showMap} header={<WorkspaceHeader create={() => openNew('lesson')} openMenu={() => setDialog('menu')} menuInBottom={showBottomNavigation} />} navigation={Platform.OS !== 'web' && width >= 600 ? <StudentNavigation rail={width >= 960} screen={screen} navigate={navigate} /> : null} footer={showBottomNavigation ? <StudentNavigation bottom screen={screen} navigate={navigate} openMenu={() => setDialog('menu')} /> : null}><NavigationSwipe screen={screen} navigate={navigate} enabled={hasBottomNavigation} fill><WorkspaceScroll scrollRef={scroll} nestedScrollEnabled directionalLockEnabled keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: width < 600 ? 16 : 32, gap: 24, flexGrow: 1, width: '100%', maxWidth: Platform.OS === 'web' ? 1280 : 1600, alignSelf: 'center' }}>

    {app.cloud.offline ? <Text accessibilityLiveRegion="polite" className="rounded-lg bg-muted px-4 py-3 text-sm text-muted-foreground">Offline módban vagy. A módosítások ezen az eszközön mentve; kapcsolódáskor automatikusan szinkronizálunk.</Text> : null}
    {app.error ? <ErrorAcknowledgement error={app.error} acknowledge={() => app.setError('')} /> : null}
    {!app.profileList.length ? <EmptyState create={() => setDialog('profiles')} /> : <WorkspacePages screen={screen} renderPage={page => page === 'compare'
      ? <CompareWorkspace active={screen === 'compare'} pageScroll={scroll} data={data} selectEvent={setEvent} selectNotebook={setNotebook} addCalendar={() => setAddingCalendar(true)} openProfiles={() => setDialog('profiles')} />
      : <StudentWorkspace key={data.ownId} profileId={data.ownId} openEvent={setEvent} openNotebook={setNotebook} openNew={openNew} openMap={openRoomMap} screen={page} openTasks={() => navigate('tasks')} calendar={<CalendarWorkspace pageScroll={scroll} active={screen === 'calendar'} comparison={false} data={data} selectEvent={setEvent} selectNotebook={setNotebook} addCalendar={() => setAddingCalendar(true)} />} />}
    />}
    {addingCalendar ? <Modal title="Órarend hozzáadása" description="Válassz egy még meg nem nyitott órarendet." close={() => setAddingCalendar(false)}>{availableProfiles.map(profile => <Action key={profile.id} secondary onPress={() => addCalendar(profile.id)}>{profile.name}</Action>)}</Modal> : null}
    {dialog === 'profiles' ? <ProfilesDialog close={() => setDialog(null)} onCreated={id => { setImportProfileId(id); setDialog('import'); }} onImport={id => { setImportProfileId(id); setDialog('import'); }} /> : null}
    {dialog === 'import' ? <ImportDialog profileId={importProfileId ?? data.ownId} close={() => { setImportProfileId(undefined); setDialog(null); }} /> : null}
    {dialog === 'manual' ? <ManualDialog profileId={data.ownId} initialCategory={manualCategory} close={() => setDialog(null)} openMap={openRoomMap} /> : null}
    {dialog === 'menu' ? <WorkspaceMenu showMap={showMap} open={openDialog} close={() => setDialog(null)} /> : null}
    {dialog === 'sync' ? <Modal title="Naptárszinkronizálás" close={() => setDialog(null)}><CalendarSyncPanel syncState={syncState} onDisconnected={() => setDialog(null)} /></Modal> : null}
    {dialog === 'account' ? <AccountDialog close={() => setDialog(null)} /> : null}
    {dialog === 'links' ? <LinksDialog close={() => setDialog(null)} /> : null}
    {dialog === 'settings' ? <SettingsDialog close={() => setDialog(null)} /> : null}
    {dialog === 'reminders' ? <ReminderDialog close={() => setDialog(null)} /> : null}
    {event ? <EventDialog event={event} close={() => setEvent(undefined)} openMap={openRoomMap} /> : null}
    {notebook ? <NotebookDialog event={notebook} close={() => setNotebook(undefined)} /> : null}
    {(showMap && Platform.OS === 'ios') || isMapOpen ? <RoomMapDialog location={mapRequest?.location ?? ''} close={closeRoomMap} open={isMapOpen} /> : null}
  </WorkspaceScroll></NavigationSwipe></WorkspaceFrame>;
}
function ErrorAcknowledgement({ error, acknowledge }: { error: string; acknowledge: () => void }) {
  const rateLimited = /rate limit exceeded|too many requests|\b429\b/i.test(error);
  return <AlertDialog open onOpenChange={() => undefined}>
    <AlertDialogContent>
      <View className="flex-row items-start gap-3">
        <Icon as={TriangleAlert} size={20} className="mt-0.5 text-destructive" />
        <View className="min-w-0 flex-1 gap-2">
          <AlertDialogTitle>{rateLimited ? 'Túl sok kérés érkezett' : 'Nem sikerült a művelet'}</AlertDialogTitle>
          <AlertDialogDescription>{rateLimited ? 'Rövid idő alatt túl sok kérést küldtél. Várj egy kicsit, majd próbáld újra.' : error}</AlertDialogDescription>
        </View>
      </View>
      <AlertDialogFooter>
        <AlertDialogAction onPress={acknowledge} className="w-full sm:w-auto">
          <Text>Oké, megértettem</Text>
        </AlertDialogAction>
      </AlertDialogFooter>
    </AlertDialogContent>
  </AlertDialog>;
}
function CompareWorkspace({ pageScroll, active, data, selectEvent, selectNotebook, addCalendar, openProfiles }: { pageScroll: React.RefObject<ScrollView | null>; active: boolean; data: ReturnType<typeof useCalendarData>; selectEvent: (event: DisplayEvent) => void; selectNotebook: (event: DisplayEvent) => void; addCalendar: () => void; openProfiles: () => void }) {
  const app = useApp();
  const [freeTimeOpen, setFreeTimeOpen] = useState(false);
  const selected = new Set([data.ownId, ...app.view.openProfiles]);
  function toggle(profileId: number) {
    if (profileId === data.ownId) return;
    if (selected.has(profileId)) app.setView(current => closeOpenProfile(current, profileId, data.ownId));
    else app.setView(current => openProfile(current, profileId));
  }
  return <View className="gap-6">
    <WorkspaceHeading icon={UsersRound} title="Órarendek összevetése" detail="Nézd meg, mikor értek rá egyszerre." />
    <View className="gap-4 rounded-xl border border-border bg-card p-4 sm:p-5">
      <View className="gap-1"><Text className="text-base font-semibold">Válaszd ki a profilokat</Text><Text className="text-sm leading-5 text-muted-foreground">A saját órarended mindig látszik. A kiválasztott naptárak egymás mellett nyílnak meg.</Text></View>
      <View className="flex-row flex-wrap gap-2">
        {app.profileList.map(profile => {
          const isSelected = selected.has(profile.id);
          return <Button key={profile.id} disabled={profile.id === data.ownId} accessibilityState={{ selected: isSelected }} onPress={() => toggle(profile.id)} variant="ghost" className={`h-10 rounded-full border px-3 ${isSelected ? 'border-primary/30 bg-accent' : 'border-border bg-background'}`}>
            <View className={`mr-2 h-2.5 w-2.5 rounded-full ${isSelected ? 'bg-primary' : 'bg-muted-foreground/40'}`} />
            <Text className={`text-sm ${isSelected ? 'font-semibold text-primary' : 'text-foreground'}`} numberOfLines={1}>{profile.name}{profile.isOwn ? ' · Saját' : ''}</Text>
          </Button>;
        })}
        <Action secondary icon={Plus} onPress={openProfiles}>Profilok kezelése</Action>
      </View>
      {app.profileList.length > 1 ? <View className="border-t border-border pt-3"><Action quiet icon={Clock3} onPress={() => setFreeTimeOpen(true)}>Közös szabad idő keresése</Action></View> : null}
    </View>
    {data.extras.length ? <CalendarWorkspace pageScroll={pageScroll} active={active} comparison data={data} selectEvent={selectEvent} selectNotebook={selectNotebook} addCalendar={addCalendar} /> : <View className="min-h-48 items-center justify-center gap-3 border-b border-border px-4 py-8 text-center">
      <View className="h-12 w-12 items-center justify-center rounded-full bg-accent"><Icon as={UsersRound} size={22} className="text-primary" /></View>
      <Text className="text-lg font-semibold">Válassz egy másik órarendet</Text>
      <Text className="max-w-sm text-center text-sm leading-5 text-muted-foreground">Ezután egy közös hét nézetben látod az órákat és az ütközéseket.</Text>
      <Action secondary icon={Plus} onPress={app.profileList.length > 1 ? addCalendar : openProfiles}>{app.profileList.length > 1 ? 'Másik órarend hozzáadása' : 'Első összehasonlító profil létrehozása'}</Action>
    </View>}
    {freeTimeOpen ? <FreeTimeDialog profileId={data.ownId} close={() => setFreeTimeOpen(false)} /> : null}
  </View>;
}

function CalendarWorkspace({ pageScroll, active, comparison, data, selectEvent, selectNotebook, addCalendar }: { pageScroll: React.RefObject<ScrollView | null>; active: boolean; comparison: boolean; data: ReturnType<typeof useCalendarData>; selectEvent: (event: DisplayEvent) => void; selectNotebook: (event: DisplayEvent) => void; addCalendar: () => void }) {
  const app = useApp(); const { width } = useWindowDimensions();
  const workspaceWidth = Platform.OS === 'web' ? Math.min(width - (width >= 960 ? 232 : 0), 1280) : Math.min(width, 1600);
  const [measuredWidth, setMeasuredWidth] = useState(0); const [todayRequest, setTodayRequest] = useState(0); const horizontalScroll = useRef<ScrollView>(null);
  function showToday() { const date = today(); app.setView({ leftDate: date, rightDate: date }); setTodayRequest(current => current + 1); pageScroll.current?.scrollTo({ y: 0, animated: true }); }
  function measureWorkspace(event: LayoutChangeEvent) { setMeasuredWidth(event.nativeEvent.layout.width); }
  const profiles = comparison ? data.extras : [];
  const contentWidth = Platform.OS === 'web' && measuredWidth ? measuredWidth : workspaceWidth - (width < 600 ? 32 : 64); const sideBySide = comparison || app.view.arrangement === 'row' && profiles.length > 0;
  const nativeRow = sideBySide && (Platform.OS !== 'web' || width < 600); const panelWidth = sideBySide ? Math.max(nativeRow && app.view.mode === 'week' ? 1092 : 320, (contentWidth - 24) / 2) : contentWidth;
  const { closeCalendar } = calendarActions(app, data.ownId, () => undefined);
  const panels = <><CalendarPanel todayRequest={todayRequest} outerScrollRef={horizontalScroll} active={active} importReady={data.loadedVersion === app.version} comparison={comparison} side="left" date={data.ownDate} profileId={data.ownId} profileName={profileName(app.profileList, data.ownId)} panelWidth={panelWidth} outerHorizontalScroll={nativeRow} events={data.ownEvents} common={comparison ? data.ownCommon : new Set<string>()} selectEvent={selectEvent} selectNotebook={selectNotebook} />{profiles.map(extra => <CalendarPanel todayRequest={todayRequest} outerScrollRef={horizontalScroll} active={active} importReady={data.loadedVersion === app.version} comparison key={extra.id} side="right" date={extra.date} profileId={extra.id} profileName={profileName(app.profileList, extra.id)} panelWidth={panelWidth} outerHorizontalScroll={nativeRow} events={extra.events} common={extra.common} selectEvent={selectEvent} selectNotebook={selectNotebook} onClose={closeCalendar.bind(null, extra.id)} />)}</>;
  return <View onLayout={Platform.OS === 'web' ? measureWorkspace : undefined} className="gap-5"><TimetableToolbar onToday={showToday} comparison={comparison} />{sideBySide ? <ScrollView ref={horizontalScroll} horizontal nestedScrollEnabled directionalLockEnabled contentContainerStyle={{ gap: 20 }}>{panels}</ScrollView> : <View className="gap-6">{panels}</View>}{comparison && app.profileList.length > app.view.openProfiles.length + 1 ? <View className="self-start"><Action secondary icon={Plus} onPress={addCalendar}>Másik órarend hozzáadása</Action></View> : null}</View>;
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
  const [loadedVersion, setLoadedVersion] = useState(-1);
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
      if (!canceled) { setEventsById(Object.fromEntries(entries)); setLoadedVersion(version); }
    }
    function failed(error: unknown) { if (!canceled) setError(String(error)); }
    void load().catch(failed);
    return () => { canceled = true; };
  }, [ownId, ownDate, extraDate, days, version, view.hidden, view.openProfiles, setError]);
  const ownEvents = eventsById[ownId] ?? [];
  const extras = view.openProfiles.map(id => ({ id, date: extraDate, events: eventsById[id] ?? [], common: commonKeys(eventsById[id] ?? [], ownEvents) }));
  const ownCommon = new Set(extras.flatMap(extra => [...commonKeys(ownEvents, extra.events)]));
  return { ownId, ownDate, ownEvents, ownCommon, extras, loadedVersion };
}
function EmptyState({ create }: { create: () => void }) {
  return <View className="min-h-96 max-w-2xl justify-center gap-5 px-2 py-12 sm:px-10">
    <Image source={require('@/assets/images/triton-v15.png')} accessibilityLabel="Triton42 logó" contentFit="contain" style={{ width: 56, height: 56 }} />
    <View className="gap-2"><Text className="text-3xl font-bold tracking-tight">Kezdd a saját órarendeddel.</Text><Text className="max-w-md text-base leading-7 text-muted-foreground">Hozz létre egy profilt, majd importáld az órarendedet. Ezután külön nézetben követheted a napodat, a határidőket és a közös szabad időt.</Text></View><View className="self-start"><Action icon={Plus} onPress={create}>Első profil létrehozása</Action></View>
  </View>;
}

function WorkspaceHeader({ create, openMenu, menuInBottom }: { create: () => void; openMenu: () => void; menuInBottom: boolean }) {
  const { measureHeader } = usePanelViewport();
  return <View onLayout={measureHeader} className="border-b border-border bg-background px-5 pb-2 pt-3 sm:px-7 sm:py-2">
    <View className="flex-row flex-wrap items-center justify-between gap-3"><View style={{ marginLeft: 8, transform: [{ translateY: 4 }] }} className="flex-row items-center gap-2"><Image source={require('@/assets/images/triton-v15.png')} accessibilityLabel="Triton42 logó" contentFit="contain" style={{ width: 38, height: 38 }} /><BrandWordmark className="text-lg font-bold tracking-tight" /></View><View className="flex-row items-center gap-1">
      {!menuInBottom ? <Button variant="ghost" size="icon" accessibilityLabel="Továbbiak" className="h-10 w-10 rounded-full border-0 bg-transparent" onPress={openMenu}><Icon as={Ellipsis} size={20} /></Button> : null}
      <Button accessibilityLabel="Új óra vagy esemény" className="h-10 gap-1.5 rounded-lg px-3" onPress={create}><Icon as={Plus} size={17} className="text-primary-foreground" /><Text className="text-sm">Új esemény</Text></Button>
    </View></View>
  </View>;
}
type UtilityMenuItem = { icon: LucideIcon; label: string; dialog: DialogName; active?: boolean };

function WorkspaceMenu({ showMap, open, close }: { showMap: boolean; open: (dialog: DialogName) => void; close: () => void }) {
  const { remindersEnabled, profileList } = useApp();
  const source = useSourceStatus(profileList.find(profile => profile.isOwn)?.id ?? 0);
  const accountItems: UtilityMenuItem[] = [
    { icon: Users, label: 'Profilok kezelése', dialog: 'profiles' },
    { icon: UsersRound, label: 'Fiók', dialog: 'account' },
    ...(Platform.OS !== 'web' ? [{ icon: Bell, label: 'Értesítések', dialog: 'reminders' as const, active: remindersEnabled }] : []),
  ];
  const calendarItems: UtilityMenuItem[] = [
    { icon: Link2, label: 'Linkek és szinkron', dialog: 'links' },
    { icon: Settings2, label: 'Beállítások', dialog: 'settings' },
    ...(showMap ? [{ icon: MapPinned, label: 'Teremtérkép', dialog: 'map' as const }] : []),
    ...(source?.url && Platform.OS !== 'web' ? [{ icon: RefreshCw, label: 'Naptárszinkronizálás', dialog: 'sync' as const }] : []),
  ];
  return <Modal title="Továbbiak" maxWidth={520} close={close}>
    <View className="gap-5">
      <UtilitySection title="Fiók és profilok" items={accountItems} open={open} />
      <UtilitySection title="Órarend és megjelenés" items={calendarItems} open={open} />
    </View>
  </Modal>;
}

function UtilitySection({ title, items, open }: { title: string; items: UtilityMenuItem[]; open: (dialog: DialogName) => void }) {
  return <View className="gap-2">
    <Text accessibilityRole="header" className="px-1 text-sm font-semibold text-foreground">{title}</Text>
    <View className="overflow-hidden rounded-xl border border-border bg-background">
      {items.map((item, index) => <View key={item.dialog}>
        {index > 0 ? <View className="ml-[60px] mr-3 border-t border-border" /> : null}
        <Button accessibilityLabel={item.label} variant="ghost" className="h-auto min-h-[68px] w-full justify-start gap-3 rounded-none border-0 bg-transparent px-3 py-3" onPress={() => open(item.dialog)}>
          <View className={`h-9 w-9 shrink-0 items-center justify-center rounded-lg [&_svg]:!size-5 ${item.active ? 'bg-primary/15' : 'bg-accent'}`}><Icon as={item.icon} size={20} className="text-primary" /></View>
          <Text className="min-w-0 flex-1 text-sm font-semibold text-foreground">{item.label}</Text>
          <Icon as={ChevronRight} size={16} className="text-muted-foreground" />
        </Button>
      </View>)}
    </View>
  </View>;
}
