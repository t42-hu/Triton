import { useEffect, useRef } from 'react';
import { Pressable, ScrollView, View, useWindowDimensions } from 'react-native';
import { BookOpen, ChevronLeft, ChevronRight, X } from 'lucide-react-native';
import { Icon } from '@/components/ui/icon';
import { Button } from '@/components/ui/button';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { Text } from '@/components/ui/text';
import { Badge } from '@/components/ui/badge';
import type { DisplayEvent } from '../domain/model';
import { addDays, clockTime, dateLabel, fromWall, today, weekAt } from '../domain/time';
import { dayLayout, GRID_START, GRID_MINUTES, type PositionedEvent } from './calendar-layout';
import { eventIdentity } from '../domain/comparison';
import { useApp, type ViewState } from './app-state';
import { SourceStamp } from './source-status';

type Props = { side: 'left' | 'right'; date: string; profileId: number; profileName: string; panelWidth: number; outerHorizontalScroll?: boolean; events: DisplayEvent[]; common: Set<string>; selectEvent: (event: DisplayEvent) => void; onClose?: () => void };
export function CalendarPanel(props: Props) {
  const { view, setView, anchor } = useApp();
  const days = view.mode === 'day' ? 1 : 7;
  const dates = Array.from({ length: days }, (_, index) => addDays(props.date, index));
  const commonOnly = view.common && view.openProfiles.length > 0;
  const visible = commonOnly ? props.events.filter(event => props.common.has(eventIdentity(event))) : props.events;
  const scroll = useRef<ScrollView>(null);
  const initialScroll = useRef(props.side === 'left' ? view.leftScroll : view.rightScroll);
  useEffect(() => { scroll.current?.scrollTo({ y: Math.max(0, initialScroll.current - GRID_START) * view.zoom, animated: false }); }, [view.zoom]);
  const pinch = Gesture.Pinch().runOnJS(true).onChange(event => setView(changeZoom(event.scaleChange)));
  const panelWidth = props.panelWidth;
  const dayWidth = Math.max(days === 1 ? panelWidth - 52 : 104, (panelWidth - 52) / days);
  function move(amount: number) {
    const date = addDays(props.date, amount * days);
    if (view.sync) { setView({ leftDate: date, rightDate: date }); return; }
    setView(props.side === 'left' ? { leftDate: date } : { rightDate: date });
  }
  return <View className="overflow-hidden rounded-2xl border border-border bg-card" style={{ width: panelWidth }}>
    <CalendarHeader profileName={props.profileName} own={props.side === 'left'} date={props.date} week={weekAt(props.date, anchor)} panelWidth={panelWidth} move={move} onClose={props.onClose} />
    <SourceStamp profileId={props.profileId} />
    {!visible.length ? <View className="border-b border-border bg-muted px-4 py-2"><Text className="text-sm text-muted-foreground">{commonOnly && props.events.length ? 'Nincs közös óra ebben az időszakban. Kapcsold ki a szűrőt az összes óra megjelenítéséhez.' : 'Ebben az időszakban nincs megjeleníthető óra.'}</Text></View> : null}
    <GestureDetector gesture={pinch}><ScrollView horizontal scrollEnabled={!props.outerHorizontalScroll} contentContainerStyle={{ minWidth: '100%' }}>
      <View style={{ width: dayWidth * days + 48, flex: 1 }}>
        <View className="flex-row border-b border-border" style={{ paddingLeft: 48 }}>{dates.map(date => <DayHeading key={date} date={date} width={dayWidth} events={visible} common={props.common} selectEvent={props.selectEvent} />)}</View>
        <ScrollView ref={scroll} className={props.side === 'right' ? 'dark:bg-[#07162A]' : 'dark:bg-[#030D20]'} style={{ height: view.compare && panelWidth < 500 ? 340 : 560 }} scrollEventThrottle={200} onScroll={event => setView(props.side === 'left' ? { leftScroll: (initialScroll.current = event.nativeEvent.contentOffset.y / view.zoom + GRID_START) } : { rightScroll: (initialScroll.current = event.nativeEvent.contentOffset.y / view.zoom + GRID_START) })}>
          <View style={{ height: GRID_MINUTES * view.zoom, flexDirection: 'row' }}><TimeAxis zoom={view.zoom} />{dates.map(date => <DayColumn key={date} date={date} width={dayWidth} zoom={view.zoom} events={visible} common={props.common} selectEvent={props.selectEvent} />)}</View>
        </ScrollView>
      </View>
    </ScrollView></GestureDetector>
  </View>;
}
function CalendarHeader({ profileName, own, date, week, panelWidth, move, onClose }: { profileName: string; own: boolean; date: string; week: 'A' | 'B'; panelWidth: number; move: (amount: number) => void; onClose?: () => void }) {
  const { width } = useWindowDimensions();
  const compact = width < 600 || panelWidth < 680;
  const visibleWidth = width < 600 ? Math.min(panelWidth - 32, width - 64) : panelWidth - 32;
  const identity = <View className="min-w-0 flex-row items-center gap-2"><Text className="shrink text-[18px] font-semibold" numberOfLines={1}>{profileName}</Text>{own ? <Badge variant="secondary"><Text>Saját</Text></Badge> : null}</View>;
  const period = <PeriodNavigator date={date} week={week} compact={compact} move={move} />;
  const close = onClose ? <Button accessibilityLabel={`${profileName} naptár bezárása`} variant="ghost" className="h-[44px] w-[44px] rounded-xl border-0 bg-transparent p-0" onPress={onClose}><Icon as={X} size={18} /></Button> : null;
  return <View className="border-b border-border p-4"><View className="gap-3" style={{ width: visibleWidth }}>
    {compact ? <><View className="min-h-[44px] flex-row items-center justify-between gap-3">{identity}{close}</View>{period}</> : <View className="flex-row items-center justify-between gap-4">{identity}<View className="flex-row items-center gap-2">{period}{close}</View></View>}
  </View></View>;
}
function PeriodNavigator({ date, week, compact, move }: { date: string; week: 'A' | 'B'; compact: boolean; move: (amount: number) => void }) {
  return <View className="h-[44px] flex-row items-center rounded-xl bg-muted" style={{ width: compact ? '100%' : 264 }}>
    <PeriodArrow next={false} onPress={() => move(-1)} />
    <View className="min-w-0 flex-1 flex-row items-center justify-center gap-2"><Text className="shrink text-center text-[14px] font-medium" numberOfLines={1}>{dateLabel(date)}</Text><Badge variant="secondary"><Text>{week} hét</Text></Badge></View>
    <PeriodArrow next onPress={() => move(1)} />
  </View>;
}
function PeriodArrow({ next, onPress }: { next: boolean; onPress: () => void }) {
  return <Button accessibilityLabel={next ? 'Következő időszak' : 'Előző időszak'} hitSlop={6} variant="ghost" className="h-[44px] w-[44px] rounded-xl border-0 bg-transparent p-0" onPress={onPress}><Icon as={next ? ChevronRight : ChevronLeft} size={17} /></Button>;
}
function changeZoom(scaleChange: number): (current: ViewState) => Partial<ViewState> {
  return current => ({ zoom: Math.min(2.5, Math.max(0.5, current.zoom * scaleChange)) });
}
function DayHeading({ date, width, events, common, selectEvent }: { date: string; width: number; events: DisplayEvent[]; common: Set<string>; selectEvent: Props['selectEvent'] }) {
  const allDay = events.filter(event => event.kind === 'allDay' && event.start < fromWall(addDays(date, 1)) && event.end > fromWall(date));
  return <View className={`gap-1 border-l border-border px-2 py-3 ${date === today() ? 'bg-accent' : ''}`} style={{ width }}><Text className={date === today() ? 'text-sm font-bold text-primary' : 'text-sm text-muted-foreground'}>{dateLabel(date)}</Text>
    {allDay.map(event => <Pressable key={eventIdentity(event)} accessibilityRole="button" accessibilityLabel={`${event.title}${common.has(eventIdentity(event)) ? ', közös óra' : ''}`} onPress={() => selectEvent(event)} className="rounded bg-accent p-1"><View className="flex-row items-start gap-1">{common.has(eventIdentity(event)) ? <Icon as={BookOpen} size={13} className="mt-0.5 shrink-0 text-primary" /> : null}<Text className="shrink text-xs" numberOfLines={2}>{event.title}</Text></View></Pressable>)}
  </View>;
}
function TimeAxis({ zoom }: { zoom: number }) {
  return <View style={{ width: 48 }}>{Array.from({ length: GRID_MINUTES / 60 + 1 }, (_, hour) => <Text key={hour} className="absolute right-2 text-xs text-muted-foreground" style={{ top: Math.min(hour * 60 * zoom + 2, GRID_MINUTES * zoom - 14), fontVariant: ['tabular-nums'] }}>{String(hour + GRID_START / 60).padStart(2, '0')}:00</Text>)}</View>;
}
function DayColumn({ date, width, zoom, events, common, selectEvent }: { date: string; width: number; zoom: number; events: DisplayEvent[]; common: Set<string>; selectEvent: Props['selectEvent'] }) {
  return <View className="overflow-hidden border-l border-border" style={{ width }}>
    {Array.from({ length: GRID_MINUTES / 60 + 1 }, (_, hour) => <View key={hour} className="absolute w-full border-t border-border/40" style={{ top: hour * 60 * zoom }} />)}
    {dayLayout(events, date).map(item => <EventBlock key={eventIdentity(item.event)} item={item} zoom={zoom} shared={common.has(eventIdentity(item.event))} selectEvent={selectEvent} />)}
  </View>;
}
function EventBlock({ item, zoom, shared, selectEvent }: { item: PositionedEvent; zoom: number; shared: boolean; selectEvent: Props['selectEvent'] }) {
  const event = item.event;
  return <Pressable accessibilityRole="button" accessibilityLabel={`${event.title}, ${clockTime(event.start)}, terem: ${event.location || 'nincs'}, ${shared ? 'közös óra' : ''}`} onPress={() => selectEvent(event)} className={`absolute overflow-hidden rounded-lg border-l-2 p-2 active:opacity-70 ${shared ? 'border-primary bg-accent' : 'border-primary/40 bg-secondary'} ${event.hidden ? 'opacity-40' : ''}`} style={{ top: item.top * zoom + 1, height: Math.max(18, item.height * zoom - 2), left: `${item.lane * 100 / item.lanes}%`, width: `${100 / item.lanes}%` }}>
    <View className="flex-row items-start gap-1">{shared ? <Icon as={BookOpen} size={14} className="mt-0.5 shrink-0 text-primary" /> : null}<Text className="shrink text-xs font-semibold" numberOfLines={2}>{event.title}</Text></View><Text className="text-xs text-muted-foreground">{clockTime(event.start)}–{clockTime(event.end)}</Text><Text className="text-xs font-semibold" numberOfLines={1}>{event.location}</Text>
  </Pressable>;
}
