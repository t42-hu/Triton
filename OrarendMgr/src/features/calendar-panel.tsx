import { useEffect, useRef } from 'react';
import { Pressable, ScrollView, View, useWindowDimensions } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { Text } from '@/components/ui/text';
import { Badge } from '@/components/ui/badge';
import type { DisplayEvent } from '../domain/model';
import { addDays, clockTime, dateLabel, fromWall, today, weekAt } from '../domain/time';
import { dayLayout, type PositionedEvent } from './calendar-layout';
import { eventIdentity } from '../domain/comparison';
import { Action, Choice } from './controls';
import { useApp, type ViewState } from './app-state';
import { SourceStamp } from './source-status';

type Props = { side: 'left' | 'right'; date: string; profileId: number; events: DisplayEvent[]; common: Set<string>; selectEvent: (event: DisplayEvent) => void };
export function CalendarPanel(props: Props) {
  const { view, setView, anchor, profileList } = useApp();
  const { width } = useWindowDimensions();
  const days = view.mode === 'day' ? 1 : 7;
  const dates = Array.from({ length: days }, (_, index) => addDays(props.date, index));
  const visible = view.common && view.compare ? props.events.filter(event => props.common.has(eventIdentity(event))) : props.events;
  const scroll = useRef<ScrollView>(null);
  const initialScroll = useRef(props.side === 'left' ? view.leftScroll : view.rightScroll);
  useEffect(() => { scroll.current?.scrollTo({ y: initialScroll.current * view.zoom, animated: false }); }, [view.zoom]);
  const pinch = Gesture.Pinch().runOnJS(true).onChange(event => setView(changeZoom(event.scaleChange)));
  const contentWidth = Math.min(width, 1600) - (width < 600 ? 32 : 64);
  const panelWidth = view.compare && width >= 1000 ? (contentWidth - 16) / 2 : contentWidth;
  const dayWidth = Math.max(days === 1 ? panelWidth - 52 : 104, (panelWidth - 52) / days);
  function move(amount: number) {
    const date = addDays(props.date, amount * days);
    if (view.sync) { setView({ leftDate: date, rightDate: date }); return; }
    setView(props.side === 'left' ? { leftDate: date } : { rightDate: date });
  }
  return <View className="overflow-hidden rounded-2xl border border-border bg-card" style={width >= 1000 ? { flex: 1 } : undefined}>
    <View className="flex-row flex-wrap items-center justify-between gap-3 border-b border-border p-4">
      <Choice label={`${props.side === 'left' ? 'Első' : 'Második'} profil`} value={String(props.profileId)} options={profileList.map(profile => ({ value: String(profile.id), label: `${profile.isOwn ? '★ ' : ''}${profile.name}` }))} onChange={id => setView(props.side === 'left' ? { left: Number(id) } : { right: Number(id) })} />
      <View className="flex-row flex-wrap items-center gap-1"><Action quiet label="Előző időszak" onPress={() => move(-1)}>‹</Action><Text className="text-sm font-medium">{dateLabel(props.date)}</Text><Action quiet label="Következő időszak" onPress={() => move(1)}>›</Action><Badge variant="secondary"><Text>{weekAt(props.date, anchor)} hét</Text></Badge></View>
    </View>
    <SourceStamp profileId={props.profileId} />
    <GestureDetector gesture={pinch}><ScrollView horizontal contentContainerStyle={{ minWidth: '100%' }}>
      <View style={{ width: dayWidth * days + 48, flex: 1 }}>
        <View className="flex-row border-b border-border" style={{ paddingLeft: 48 }}>{dates.map(date => <DayHeading key={date} date={date} width={dayWidth} events={visible} common={props.common} selectEvent={props.selectEvent} />)}</View>
        <ScrollView ref={scroll} style={{ height: view.compare && width < 1000 ? 340 : 560 }} scrollEventThrottle={200} onScroll={event => setView(props.side === 'left' ? { leftScroll: (initialScroll.current = event.nativeEvent.contentOffset.y / view.zoom) } : { rightScroll: (initialScroll.current = event.nativeEvent.contentOffset.y / view.zoom) })}>
          <View style={{ height: 1440 * view.zoom, flexDirection: 'row' }}><TimeAxis zoom={view.zoom} />{dates.map(date => <DayColumn key={date} date={date} width={dayWidth} zoom={view.zoom} events={visible} common={props.common} selectEvent={props.selectEvent} />)}</View>
        </ScrollView>
      </View>
    </ScrollView></GestureDetector>
  </View>;
}
function changeZoom(scaleChange: number): (current: ViewState) => Partial<ViewState> {
  return current => ({ zoom: Math.min(2.5, Math.max(0.5, current.zoom * scaleChange)) });
}
function DayHeading({ date, width, events, common, selectEvent }: { date: string; width: number; events: DisplayEvent[]; common: Set<string>; selectEvent: Props['selectEvent'] }) {
  const allDay = events.filter(event => event.kind === 'allDay' && event.start < fromWall(addDays(date, 1)) && event.end > fromWall(date));
  return <View className={`gap-1 border-l border-border px-2 py-3 ${date === today() ? 'bg-accent' : ''}`} style={{ width }}><Text className={date === today() ? 'text-sm font-bold text-primary' : 'text-sm text-muted-foreground'}>{dateLabel(date)}</Text>
    {allDay.map(event => <Pressable key={eventIdentity(event)} accessibilityRole="button" onPress={() => selectEvent(event)} className="rounded bg-accent p-1"><Text className="text-xs" numberOfLines={2}>{common.has(eventIdentity(event)) ? '◆ ' : ''}{event.title}</Text></Pressable>)}
  </View>;
}
function TimeAxis({ zoom }: { zoom: number }) {
  return <View style={{ width: 48 }}>{Array.from({ length: 24 }, (_, hour) => <Text key={hour} className="absolute right-2 text-xs text-muted-foreground" style={{ top: hour * 60 * zoom + 2, fontVariant: ['tabular-nums'] }}>{String(hour).padStart(2, '0')}:00</Text>)}</View>;
}
function DayColumn({ date, width, zoom, events, common, selectEvent }: { date: string; width: number; zoom: number; events: DisplayEvent[]; common: Set<string>; selectEvent: Props['selectEvent'] }) {
  return <View className="border-l border-border" style={{ width }}>
    {Array.from({ length: 24 }, (_, hour) => <View key={hour} className="absolute w-full border-t border-border/40" style={{ top: hour * 60 * zoom }} />)}
    {dayLayout(events, date).map(item => <EventBlock key={eventIdentity(item.event)} item={item} zoom={zoom} shared={common.has(eventIdentity(item.event))} selectEvent={selectEvent} />)}
  </View>;
}
function EventBlock({ item, zoom, shared, selectEvent }: { item: PositionedEvent; zoom: number; shared: boolean; selectEvent: Props['selectEvent'] }) {
  const event = item.event;
  return <Pressable accessibilityRole="button" accessibilityLabel={`${event.title}, ${clockTime(event.start)}, terem: ${event.location || 'nincs'}, ${shared ? 'közös óra' : ''}`} onPress={() => selectEvent(event)} className={`absolute overflow-hidden rounded-lg border-l-2 p-2 active:opacity-70 ${shared ? 'border-primary bg-accent' : 'border-primary/40 bg-secondary'} ${event.hidden ? 'opacity-40' : ''}`} style={{ top: item.top * zoom + 1, height: Math.max(18, item.height * zoom - 2), left: `${item.lane * 100 / item.lanes}%`, width: `${100 / item.lanes}%` }}>
    <Text className="text-xs font-semibold" numberOfLines={2}>{shared ? '◆ ' : ''}{event.title}</Text><Text className="text-xs text-muted-foreground">{clockTime(event.start)}–{clockTime(event.end)}</Text><Text className="text-xs font-semibold" numberOfLines={1}>{event.location}</Text>
  </Pressable>;
}
