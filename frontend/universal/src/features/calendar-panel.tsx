import { CalendarDragProvider, DraggableCalendarEvent, useCalendarDrag } from './calendar-event-drag';
import { NotebookDialog } from './notebook-dialog';
import { useNotebookQuickLink } from './use-notebook-quick-link';
import { ImportReveal } from './import-reveal';
import { AnimatedDisclosure } from './animated-disclosure';
import { useWorkspaceSwipeGesture } from './navigation-swipe';
import { CurrentTimeLine } from './current-time-line';
import { useEventAppearance } from './use-event-appearance';
import { useCallback, useEffect, useRef, useState, type ReactNode, type RefObject } from 'react';
import Animated from 'react-native-reanimated';
import { usePeriodTransition } from '@/hooks/use-motion-value';
import { Platform, Pressable, ScrollView, View, useWindowDimensions, type NativeScrollEvent, type NativeSyntheticEvent } from 'react-native';
import { BookOpen, CalendarDays, ChevronLeft, ChevronRight, ChevronDown, ChevronUp, MapPin, Monitor, PencilLine, Presentation, X, NotebookPen, CalendarClock, ClipboardCheck, GraduationCap, BriefcaseBusiness, type LucideIcon } from 'lucide-react-native';
import { Icon } from '@/components/ui/icon';
import { Button } from '@/components/ui/button';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { Text } from '@/components/ui/text';
import { Badge } from '@/components/ui/badge';
import type { DisplayEvent } from '../domain/model';
import { addDays, clockTime, dateLabel, fromWall, importedWeekNumber, today, weekAt } from '../domain/time';
import { dayLayout, GRID_START, GRID_END, INITIAL_CALENDAR_MINUTE, type PositionedEvent } from './calendar-layout';
import { eventIdentity } from '../domain/comparison';
import { lessonType } from '../domain/lesson-type';
import { categoryLabel, supportsStudyLinks } from '../domain/student';
import { dailyAnalysis } from '../domain/schedule-analysis';
import { useApp, type ViewState } from './app-state';
import { ZoomControls } from './timetable-toolbar';
import { SourceStamp, useFirstImportedWeek } from './source-status';

type Props = { todayRequest?: number; outerScrollRef?: RefObject<ScrollView | null>; active?: boolean; importReady?: boolean; side: 'left' | 'right'; date: string; profileId: number; profileName: string; panelWidth: number; outerHorizontalScroll?: boolean; events: DisplayEvent[]; common: Set<string>; selectEvent: (event: DisplayEvent) => void; selectNotebook: (event: DisplayEvent) => void; onClose?: () => void };
export function CalendarPanel(props: Props) {
  const { view, setView, anchor, calendarImport } = useApp();
  const revision = props.importReady && calendarImport?.profileId === props.profileId ? calendarImport.revision : 0;
  const periodStyle = usePeriodTransition(props.date);
  const gridStart = GRID_START; const gridEnd = GRID_END; const gridMinutes = gridEnd - gridStart;
  const days = view.mode === 'day' ? 1 : view.showWeekends ? 7 : 5;
  const dates = Array.from({ length: days }, (_, index) => addDays(props.date, index));
  const commonOnly = view.common && view.openProfiles.length > 0;
  const visible = commonOnly ? props.events.filter(event => props.common.has(eventIdentity(event))) : props.events;
  const { scroll, scrollToMorning, onScroll, onContentSizeChange } = usePanelScroll(props.side, view.zoom, gridStart, props.active ?? true, setView);
  const panelViewport = usePanelHeight(560);
  const verticalScroll = Gesture.Native();
  const workspaceSwipe = useWorkspaceSwipeGesture();
  const horizontalScroll = Gesture.Native();
  if (workspaceSwipe) horizontalScroll.blocksExternalGesture(workspaceSwipe);
  const pinch = Gesture.Pinch().simultaneousWithExternalGesture(verticalScroll, horizontalScroll).runOnJS(true).onChange(event => setView(changeZoom(event.scaleChange)));
  const panelWidth = props.panelWidth;
  const dayWidth = Math.max(days === 1 ? panelWidth - 56 : 148, (panelWidth - 56) / days);
  const horizontalRef = useRef<ScrollView>(null);
  useTodayScroll(props.todayRequest ?? 0, props.date, dayWidth, scrollToMorning, props.outerHorizontalScroll ? (props.side === 'left' ? props.outerScrollRef : undefined) : horizontalRef);
  const grid = <CalendarDragProvider grid={{ firstDate: props.date, days, dayWidth, zoom: view.zoom, startMinute: gridStart, endMinute: gridEnd }} blockers={[verticalScroll, horizontalScroll]}><Animated.View style={[{ width: dayWidth * days + 56, flex: 1 }, periodStyle]}>
    <View className="flex-row border-b border-border bg-muted/40" style={{ paddingLeft: 56 }}>{dates.map(date => <DayHeading key={date} date={date} width={dayWidth} events={visible} common={props.common} selectEvent={props.selectEvent} selectNotebook={props.selectNotebook} />)}</View>
    <GestureDetector gesture={verticalScroll} touchAction="manipulation"><ScrollView ref={scroll} accessibilityLabel="Órarend időrács" nestedScrollEnabled directionalLockEnabled className="bg-card" style={{ height: panelViewport, ...(Platform.OS === 'web' ? { overscrollBehaviorY: 'contain' as const, overscrollBehaviorX: 'auto' as const } : {}) }} scrollEventThrottle={100} onScroll={onScroll} onContentSizeChange={onContentSizeChange}>
      <View style={{ height: gridMinutes * view.zoom, flexDirection: 'row' }}><TimeAxis zoom={view.zoom} gridStart={gridStart} gridMinutes={gridMinutes} />{dates.map((date, index) => <CalendarDayReveal key={index} date={date} revision={revision} delay={70 + index * 35} width={dayWidth}><DayColumn date={date} width={dayWidth} zoom={view.zoom} gridStart={gridStart} gridEnd={gridEnd} events={visible} common={props.common} selectEvent={props.selectEvent} selectNotebook={props.selectNotebook} /></CalendarDayReveal>)}</View>
    </ScrollView></GestureDetector>
  </Animated.View></CalendarDragProvider>;
  function move(amount: number) {
    const date = addDays(props.date, amount * (view.mode === 'day' ? 1 : 7));
    if (view.sync) { setView({ leftDate: date, rightDate: date }); return; }
    setView(props.side === 'left' ? { leftDate: date } : { rightDate: date });
  }
  return <ImportReveal revision={revision}><View className="overflow-hidden rounded-lg border border-border bg-card" style={{ width: panelWidth }}>
    <CalendarHeader profileId={props.profileId} profileName={props.profileName} own={props.side === 'left'} date={props.date} week={weekAt(props.date, anchor)} panelWidth={panelWidth} outerHorizontalScroll={props.outerHorizontalScroll} move={move} onClose={props.onClose} />
    <SourceStamp profileId={props.profileId} />
    {!visible.length ? <View className="border-b border-border bg-muted px-5 py-3"><Text className="text-sm text-muted-foreground">{commonOnly && props.events.length ? 'Nincs közös óra ebben az időszakban. Kapcsold ki a szűrőt az összes óra megjelenítéséhez.' : 'Ebben az időszakban nincs megjeleníthető óra.'}</Text></View> : null}
    <GestureDetector gesture={pinch} touchAction="manipulation"><View collapsable={false}>{props.outerHorizontalScroll ? grid : <GestureDetector gesture={horizontalScroll} touchAction="manipulation"><ScrollView ref={horizontalRef} horizontal nestedScrollEnabled directionalLockEnabled contentContainerStyle={{ minWidth: '100%' }}>{grid}</ScrollView></GestureDetector>}</View></GestureDetector>
    <CalendarInsights dates={dates} events={visible} />
  </View></ImportReveal>;
}
/** A stable viewport depends on screen size, never on the outer page's scroll position. */
function usePanelHeight(maximumHeight: number) {
  const { height } = useWindowDimensions();
  return Math.min(maximumHeight, Math.max(240, height - 320));
}
function usePanelScroll(side: 'left' | 'right', zoom: number, gridStart: number, active: boolean, setView: (patch: Partial<ViewState>) => void) {
  const scroll = useRef<ScrollView>(null);
  const minute = useRef(INITIAL_CALENDAR_MINUTE);
  const hasContent = useRef(false);
  const previousActive = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const appliedZoom = useRef(zoom);
  const restorePosition = useCallback(() => {
    if (!hasContent.current || !active) return;
    if (timer.current) clearTimeout(timer.current);
    scroll.current?.scrollTo({ y: Math.max(0, minute.current - gridStart) * zoom, animated: false });
    appliedZoom.current = zoom;
  }, [active, zoom, gridStart]);
  useEffect(() => {
    if (active && !previousActive.current) minute.current = INITIAL_CALENDAR_MINUTE;
    previousActive.current = active; restorePosition();
  }, [active, restorePosition]);
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);
  function persist() { setView(side === 'left' ? { leftScroll: minute.current } : { rightScroll: minute.current }); }
  function onScroll(event: NativeSyntheticEvent<NativeScrollEvent>) {
    if (!active || !hasContent.current || appliedZoom.current !== zoom) return;
    minute.current = event.nativeEvent.contentOffset.y / zoom + gridStart;
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(persist, 350);
  }
  function onContentSizeChange() { hasContent.current = true; restorePosition(); }
  const scrollToMorning = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    minute.current = INITIAL_CALENDAR_MINUTE;
    scroll.current?.scrollTo({ y: (INITIAL_CALENDAR_MINUTE - gridStart) * zoom, animated: true });
  }, [gridStart, zoom]);
  return { scroll, scrollToMorning, onScroll, onContentSizeChange };
}
function useTodayScroll(request: number, date: string, dayWidth: number, scrollToMorning: () => void, horizontal?: RefObject<ScrollView | null>) {
  const handled = useRef(0);
  useEffect(() => {
    if (!request || request === handled.current) return;
    function revealToday() {
      handled.current = request;
      scrollToMorning();
      const index = Math.max(0, Math.round((fromWall(today()) - fromWall(date)) / 86400000));
      horizontal?.current?.scrollTo({ x: index * dayWidth, animated: true });
    }
    const frame = requestAnimationFrame(revealToday);
    return () => cancelAnimationFrame(frame);
  }, [request, date, dayWidth, horizontal, scrollToMorning]);
}
function CalendarHeader({ profileId, profileName, own, date, week, panelWidth, outerHorizontalScroll, move, onClose }: { outerHorizontalScroll?: boolean; profileId: number; profileName: string; own: boolean; date: string; week: 'A' | 'B'; panelWidth: number; move: (amount: number) => void; onClose?: () => void }) {
  const firstImportedDate = useFirstImportedWeek(profileId);
  const weekNumber = firstImportedDate ? importedWeekNumber(date, firstImportedDate) : null;
  const { width } = useWindowDimensions();
  const compact = width < 600 || panelWidth < (Platform.OS === 'web' ? 900 : 680);
  const hasViewportBoundHeader = width < 600 && (Platform.OS !== 'web' || outerHorizontalScroll);
  const visibleWidth = hasViewportBoundHeader ? Math.min(panelWidth - 32, width - 64) : panelWidth - 32;
  const identity = <View className="min-w-0 flex-row items-center gap-3"><View className="h-10 w-10 shrink-0 items-center justify-center"><Icon as={CalendarDays} size={20} className="text-muted-foreground" /></View><View className="min-w-0 flex-row items-center gap-2"><Text className="shrink text-[18px] font-semibold" numberOfLines={1}>{profileName}</Text>{own ? <Badge variant="secondary"><Text>Saját</Text></Badge> : null}</View></View>;
  const period = <PeriodNavigator date={date} week={week} weekNumber={weekNumber} compact={compact} move={move} />;
  const close = onClose ? <Button accessibilityLabel={`${profileName} naptár bezárása`} variant="ghost" className="h-[44px] w-[44px] rounded-lg border-0 bg-transparent p-0" onPress={onClose}><Icon as={X} size={18} /></Button> : null;
  if (Platform.OS === 'web' && !compact) return <View className="px-4 pb-3 pt-4"><View className="relative min-h-12 flex-row items-center justify-between" style={{ width: visibleWidth }}>{identity}<View style={{ position: 'absolute', left: '50%', top: 0, width: 340, transform: [{ translateX: -170 }] }}>{period}</View><View className="flex-row items-center gap-2"><ZoomControls />{close}</View></View></View>;
  return <View className="px-4 pb-2 pt-4"><View className="gap-3" style={{ width: visibleWidth }}>
    {compact ? <><View className="min-h-[44px] flex-row items-center justify-between gap-3">{identity}<View className="flex-row items-center gap-1"><ZoomControls />{close}</View></View>{period}</> : <View className="flex-row items-center justify-between gap-4">{identity}<View className="flex-row items-center gap-2">{period}<ZoomControls />{close}</View></View>}
  </View></View>;
}
function PeriodNavigator({ date, week, weekNumber, compact, move }: { date: string; week: 'A' | 'B'; weekNumber: number | null; compact: boolean; move: (amount: number) => void }) {
  const periodStyle = usePeriodTransition(date);
  return <View className="min-h-[48px] flex-row items-center rounded-lg bg-muted/40" style={{ width: compact ? '100%' : Platform.OS === 'web' ? 340 : 304 }}>
    <PeriodArrow next={false} onPress={() => move(-1)} />
    <Animated.View style={[periodStyle, Platform.OS === 'web' ? { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, flex: 1, minWidth: 0 } : undefined]} className="min-w-0 flex-1 flex-row items-center justify-center gap-2"><Text className="shrink text-center text-[14px] font-medium" numberOfLines={1}>{dateLabel(date)}</Text><Badge variant="secondary"><Text>{weekNumber === null ? `${week} hét` : `${week} · ${weekNumber}. hét`}</Text></Badge></Animated.View>
    <PeriodArrow next onPress={() => move(1)} />
  </View>;
}
function PeriodArrow({ next, onPress }: { next: boolean; onPress: () => void }) {
  return <Button accessibilityLabel={next ? 'Következő időszak' : 'Előző időszak'} hitSlop={6} variant="ghost" className="h-[44px] w-[44px] rounded-lg border-0 bg-transparent p-0" onPress={onPress}><Icon as={next ? ChevronRight : ChevronLeft} size={17} /></Button>;
}
function changeZoom(scaleChange: number): (current: ViewState) => Partial<ViewState> {
  return current => ({ zoom: Math.min(2.5, Math.max(0.5, current.zoom * scaleChange)) });
}
function DayHeading({ date, width, events, common, selectEvent, selectNotebook }: { date: string; width: number; events: DisplayEvent[]; common: Set<string>; selectEvent: Props['selectEvent']; selectNotebook: Props['selectNotebook'] }) {
  const allDay = events.filter(event => event.kind === 'allDay' && event.start < fromWall(addDays(date, 1)) && event.end > fromWall(date));
  const drag = useCalendarDrag();
  const isToday = date === today();
  const isSunday = new Date(`${date}T12:00:00Z`).getUTCDay() === 0;
  const weekday = new Intl.DateTimeFormat('hu-HU', { weekday: 'short', timeZone: 'Europe/Budapest' }).format(new Date(fromWall(`${date}T12:00`)));
  const month = new Intl.DateTimeFormat('hu-HU', { month: 'short', timeZone: 'Europe/Budapest' }).format(new Date(fromWall(`${date}T12:00`)));
  return <View className={`gap-1 border-l border-border px-3 py-2 ${isToday ? 'bg-primary/10' : ''}`} style={{ width, zIndex: drag?.activeColumn === date ? 20 : 0 }}><View className="flex-row items-center gap-2"><Text className={`text-2xl ${isToday ? 'font-bold' : 'font-semibold'} ${isSunday ? 'text-destructive' : isToday ? 'text-primary' : 'text-foreground'}`}>{Number(date.slice(8))}</Text><View><Text className={`text-xs font-semibold ${isSunday ? 'text-destructive' : 'text-muted-foreground'}`}>{weekday}</Text><Text className={`text-xs ${isSunday ? 'text-destructive' : 'text-muted-foreground'}`}>{month}</Text></View></View>
    {allDay.map(event => <AllDayBlock key={eventIdentity(event)} date={date} event={event} shared={common.has(eventIdentity(event))} selectEvent={selectEvent} selectNotebook={selectNotebook} />)}
  </View>;
}
function AllDayBlock({ event, date, shared, selectEvent, selectNotebook }: { date: string; event: DisplayEvent; shared: boolean; selectEvent: Props['selectEvent']; selectNotebook: Props['selectNotebook'] }) {
  const appearance = useEventAppearance(event);
  const color = appearance.urgency ?? appearance.color;
  const drag = useCalendarDrag();
  return <DraggableCalendarEvent event={event} date={date} className="relative overflow-hidden rounded border border-border bg-accent" style={{ ...(color ? { borderColor: color } : {}), ...(appearance.color ? { backgroundColor: `${appearance.color}26` } : {}) }}><Pressable accessibilityRole="button" accessibilityHint="Húzd másik napra vagy időpontra ezen a héten. Mobilon tartsd nyomva a húzás előtt." accessibilityLabel={`${event.title}, ${lessonLabel(event)}${shared ? ', közös óra' : ''}`} onPress={() => { if (!drag || drag.canOpen()) selectEvent(event); }} className="min-h-[52px] rounded p-1 pr-9 hover:bg-primary/10 active:bg-primary/15"><View className="flex-row items-start gap-1"><Icon as={lessonIcon(event)} size={14} {...(color ? { color } : {})} className="mt-0.5 shrink-0 text-primary" /><Text style={color ? { color } : undefined} className="shrink text-xs text-foreground" numberOfLines={2}>{event.title}</Text></View></Pressable><CalendarQuickLinkRail event={event} selectNotebook={selectNotebook} /></DraggableCalendarEvent>;
}
function TimeAxis({ zoom, gridStart, gridMinutes }: { zoom: number; gridStart: number; gridMinutes: number }) {
  return <View className="bg-muted/40" style={{ width: 56 }}>{Array.from({ length: gridMinutes / 60 }, (_, hour) => <Text key={hour} className="absolute right-2 text-xs font-medium text-muted-foreground" style={{ top: Math.min(hour * 60 * zoom + 2, gridMinutes * zoom - 14), fontVariant: ['tabular-nums'] }}>{String(hour + gridStart / 60).padStart(2, '0')}:00</Text>)}</View>;
}
function DayColumn({ date, width, zoom, gridStart, gridEnd, events, common, selectEvent, selectNotebook }: { date: string; width: number; zoom: number; gridStart: number; gridEnd: number; events: DisplayEvent[]; common: Set<string>; selectEvent: Props['selectEvent']; selectNotebook: Props['selectNotebook'] }) {
  const gridMinutes = gridEnd - gridStart;
  const drag = useCalendarDrag();
  const weekend = [0, 6].includes(new Date(`${date}T12:00:00Z`).getUTCDay());
  return <View className={`border-l border-border/70 ${weekend ? 'bg-muted/20' : ''}`} style={{ width, height: gridMinutes * zoom, zIndex: drag?.activeColumn === date ? 20 : 0 }}>
    {Array.from({ length: gridMinutes / 60 + 1 }, (_, hour) => <View key={hour} className="absolute w-full border-t border-border/35" style={{ top: hour * 60 * zoom }} />)}
    {dayLayout(events, date, gridStart, gridEnd).map(item => <EventBlock key={eventIdentity(item.event)} item={item} date={date} zoom={zoom} shared={common.has(eventIdentity(item.event))} selectEvent={selectEvent} selectNotebook={selectNotebook} />)}
    <CurrentTimeLine date={date} zoom={zoom} gridStart={gridStart} gridEnd={gridEnd} />
  </View>;
}
function EventBlock({ item, date, zoom, shared, selectEvent, selectNotebook }: { date: string; item: PositionedEvent; zoom: number; shared: boolean; selectEvent: Props['selectEvent']; selectNotebook: Props['selectNotebook'] }) {
  const event = item.event;
  const appearance = useEventAppearance(event);
  const color = appearance.urgency ?? appearance.color;
  const height = Math.max(18, item.height * zoom - 2);
  const dense = height < 60;
  const compactLinks = height < 48;
  const drag = useCalendarDrag();
  return <DraggableCalendarEvent event={event} date={date} className={`absolute overflow-hidden rounded-lg border ${item.lanes > 1 && !event.hidden ? 'border-destructive/60' : 'border-primary/30'} bg-secondary ${shared ? 'border-l-[3px] border-l-primary' : ''} ${event.hidden ? 'opacity-40' : ''}`} style={{ ...(color ? { borderColor: color } : {}), ...(appearance.color ? { borderLeftColor: appearance.color, borderLeftWidth: 3, backgroundColor: `${appearance.color}26` } : {}), top: item.top * zoom + 1, height, left: `${item.lane * 100 / item.lanes}%`, width: `${100 / item.lanes}%` }}>
    <Pressable accessibilityRole="button" accessibilityHint="Húzd másik napra vagy időpontra ezen a héten. Mobilon tartsd nyomva a húzás előtt." accessibilityLabel={`${event.title}, ${lessonLabel(event)}, ${clockTime(event.start)}, terem: ${event.location || 'nincs'}, ${shared ? 'közös óra' : ''}`} onPress={() => { if (!drag || drag.canOpen()) selectEvent(event); }} className="h-full rounded-lg p-2 hover:bg-primary/10 active:bg-primary/15" style={{ paddingRight: supportsStudyLinks(event) ? compactLinks ? 60 : 40 : 8 }}>{dense ? <View className="flex-row items-center gap-1"><Icon as={lessonIcon(event)} size={14} className="shrink-0 text-primary" /><Text className="shrink text-xs font-medium text-foreground" style={color ? { color } : undefined} numberOfLines={1}>{clockTime(event.start)} · {event.title}</Text></View> : <><View className="flex-row items-center gap-1"><Icon as={lessonIcon(event)} size={14} className="shrink-0 text-primary" /><Text className="shrink text-xs font-medium text-foreground" style={{ fontVariant: ['tabular-nums'], ...(color ? { color } : {}) }}>{clockTime(event.start)}–{clockTime(event.end)}</Text></View><Text className="mt-1 text-[13px] font-semibold leading-[17px] text-foreground" numberOfLines={height > 105 ? 3 : 2}>{event.title}</Text>{height > 82 && event.location ? <View className="mt-1 flex-row items-center gap-1"><Icon as={MapPin} size={14} className="shrink-0 text-muted-foreground" /><Text className="shrink text-xs text-muted-foreground" numberOfLines={1}>{event.location}</Text></View> : null}</>}
    </Pressable><CalendarQuickLinkRail event={event} selectNotebook={selectNotebook} compact={compactLinks} />
  </DraggableCalendarEvent>;
}
function lessonIcon(event: DisplayEvent) {
  if (event.category === 'work') return BriefcaseBusiness;
  if (event.category === 'assignment') return ClipboardCheck;
  if (event.category === 'exam' || event.category === 'test') return GraduationCap;
  if (event.category === 'event') return CalendarClock;
  const type = lessonType(`${event.title} ${event.originalTitle}`);
  return type === 'EA' ? Presentation : type === 'GY' ? PencilLine : type === 'LA' ? Monitor : BookOpen;
}
function lessonLabel(event: DisplayEvent) {
  if (event.category && event.category !== 'lesson') return categoryLabel(event.category);
  const type = lessonType(`${event.title} ${event.originalTitle}`);
  return type === 'EA' ? 'előadás' : type === 'GY' ? 'gyakorlat' : type === 'LA' ? 'számítógépes labor' : 'óra';
}

function CalendarQuickLinkRail({ event, selectNotebook, compact = false }: { event: DisplayEvent; selectNotebook: Props['selectNotebook']; compact?: boolean }) {
  if (!supportsStudyLinks(event)) return null;
  return <View className={`absolute bottom-0 right-0 top-0 border-l border-primary/20 bg-primary/5 ${compact ? 'flex-row' : ''}`} style={{ width: compact ? 52 : 32 }}><CalendarLearningButton event={event} compact={compact} /><CalendarNotebookButton event={event} selectNotebook={selectNotebook} compact={compact} /></View>;
}
function CalendarNotebookButton({ event, selectNotebook, compact }: { event: DisplayEvent; selectNotebook: Props['selectNotebook']; compact: boolean }) {
  const notebook = useNotebookQuickLink(event, false, () => selectNotebook(event));
  return <CalendarLinkButton disabled={notebook.loading} label={`${event.title} jegyzetfüzete`} icon={NotebookPen} compact={compact} onPress={notebook.open} />;
}
/** Compact controls are intentional inside the timetable's scaled event blocks. */
function CalendarLinkButton({ disabled, label, icon, compact, onPress }: { disabled: boolean; label: string; icon: LucideIcon; compact: boolean; onPress: () => void }) {
  return <Pressable accessibilityRole="button" accessibilityLabel={label} accessibilityState={{ disabled }} disabled={disabled} className={`flex-1 items-center justify-center hover:bg-primary/10 active:bg-primary/15 web:focus-visible:outline web:focus-visible:outline-2 web:focus-visible:outline-primary ${disabled ? 'opacity-50' : ''}`} style={{ ...(compact ? { height: '100%' } : { width: '100%', maxHeight: 32 }) }} onPress={event => { event.stopPropagation(); onPress(); }}><Icon as={icon} size={14} className="shrink-0 text-primary" /></Pressable>;
}
function CalendarInsights({ dates, events }: { dates: string[]; events: DisplayEvent[] }) {
  const [expanded, setExpanded] = useState(false);
  const analyses = dates.map(date => dailyAnalysis(events, date));
  if (!analyses.some(analysis => analysis.lessonCount > 0 || analysis.minutes > 0)) return null;
  return <View className="gap-2 border-t border-border p-3">
    {<Button variant="ghost" accessibilityLabel="Napi terhelés és szünetek" aria-expanded={expanded} accessibilityState={{ expanded }} onPress={() => setExpanded(!expanded)} className="justify-start border-0 bg-transparent px-1"><Icon as={CalendarDays} size={17} className="text-primary" /><Text className="flex-1 text-sm font-semibold">Napi terhelés és szünetek</Text><Icon as={expanded ? ChevronUp : ChevronDown} size={16} /></Button>}
    <AnimatedDisclosure expanded={expanded} gap={8}><View className="gap-2">{dates.map(date => <DayInsight key={date} date={date} events={events} />)}</View></AnimatedDisclosure>
  </View>;
}
function DayInsight({ date, events }: { date: string; events: DisplayEvent[] }) {
  const analysis = dailyAnalysis(events, date);
  if (!analysis.lessonCount && !analysis.minutes) return null;
  const gaps = analysis.gaps.map(slot => `${clockTime(slot.start)}–${clockTime(slot.end)}`).join(', ');
  return <View className="gap-1"><Text className="text-xs text-muted-foreground">{dateLabel(date)} · {analysis.lessonCount} óra · {Math.round(analysis.minutes)} perc elfoglaltság</Text>{gaps ? <Text className="text-xs text-muted-foreground">Szünet: {gaps}</Text> : null}{analysis.conflicts.length ? <Text className="text-xs font-medium text-destructive">{analysis.conflicts.length} ütközés · {analysis.conflicts.map(item => `${item.first.title} / ${item.second.title}`).join('; ')}</Text> : null}</View>;
}

function CalendarLearningButton({ event, compact }: { event: DisplayEvent; compact: boolean }) {
  const [open, setOpen] = useState(false);
  const learning = useNotebookQuickLink(event, true, () => setOpen(true));
  return <><CalendarLinkButton disabled={learning.loading} label={`${event.title}: Tanulásmenedzsment-rendszer gyorslink`} icon={GraduationCap} compact={compact} onPress={learning.open} />{open ? <NotebookDialog event={event} learning close={() => setOpen(false)} /> : null}</>;
}

function CalendarDayReveal({ date, children, ...props }: { date: string; children: ReactNode; revision: number; delay: number; width: number }) {
  const drag = useCalendarDrag();
  return <ImportReveal {...props} zIndex={drag?.activeColumn === date ? 20 : 0}>{children}</ImportReveal>;
}
