import { useEffect, useRef } from 'react';
import { Pressable, ScrollView, View, useWindowDimensions } from 'react-native';
import { useSharedValue } from 'react-native-reanimated';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { Text } from '@/components/ui/text';
import type { DisplayEvent } from '../domain/model';
import { addDays, clockTime, dateLabel, fromWall, today, weekAt } from '../domain/time';
import { dayLayout, type PositionedEvent } from './calendar-layout';
import { Action, Choice } from './controls';
import { useApp } from './app-state';

type Props = { side: 'left' | 'right'; date: string; profileId: number; events: DisplayEvent[]; common: Set<string>; selectEvent: (event: DisplayEvent) => void };
export function CalendarPanel(props: Props) {
  const { view, setView, anchor, profileList } = useApp();
  const { width } = useWindowDimensions();
  const days = view.mode === 'day' ? 1 : 7;
  const dates = Array.from({ length: days }, (_, index) => addDays(props.date, index));
  const visible = view.common && view.compare ? props.events.filter(event => props.common.has(event.key + event.sourceId)) : props.events;
  const scroll = useRef<ScrollView>(null);
  const initialScroll = useRef(props.side === 'left' ? view.leftScroll : view.rightScroll);
  const zoomAtStart = useSharedValue(view.zoom);
  useEffect(() => { scroll.current?.scrollTo({ y: initialScroll.current * view.zoom, animated: false }); }, [view.zoom]);
  const pinch = Gesture.Pinch().runOnJS(true).onBegin(() => { zoomAtStart.value = view.zoom; }).onUpdate(event => setView({ zoom: Math.min(2.5, Math.max(0.5, zoomAtStart.value * event.scale)) }));
  const panelWidth = view.compare && width >= 1000 ? (width - 100) / 2 : width - 60;
  const dayWidth = Math.max(days === 1 ? panelWidth - 52 : 104, (panelWidth - 52) / days);
  function move(amount: number) {
    const date = addDays(props.date, amount * days);
    if (view.sync) { setView({ leftDate: date, rightDate: date }); return; }
    setView(props.side === 'left' ? { leftDate: date } : { rightDate: date });
  }
  return <View className="min-h-0 flex-1 overflow-hidden rounded-xl border border-border bg-card">
    <View className="flex-row flex-wrap items-center justify-between gap-2 border-b border-border p-3">
      <Choice label={`${props.side === 'left' ? 'Első' : 'Második'} profil`} value={String(props.profileId)} options={profileList.map(profile => ({ value: String(profile.id), label: `${profile.isOwn ? '★ ' : ''}${profile.name}` }))} onChange={id => setView(props.side === 'left' ? { left: Number(id) } : { right: Number(id) })} />
      <View className="flex-row items-center gap-2"><Action secondary label="Előző időszak" onPress={() => move(-1)}>‹</Action><Text className="text-sm">{dateLabel(props.date)} · {weekAt(props.date, anchor)} hét</Text><Action secondary label="Következő időszak" onPress={() => move(1)}>›</Action></View>
    </View>
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
function DayHeading({ date, width, events, common, selectEvent }: { date: string; width: number; events: DisplayEvent[]; common: Set<string>; selectEvent: Props['selectEvent'] }) {
  const allDay = events.filter(event => event.kind === 'allDay' && event.start < fromWall(addDays(date, 1)) && event.end > fromWall(date));
  return <View className="gap-1 border-l border-border p-2" style={{ width }}><Text className={date === today() ? 'font-bold text-primary' : 'text-sm text-foreground'}>{dateLabel(date)}</Text>
    {allDay.map(event => <Pressable key={event.sourceId + event.key} accessibilityRole="button" onPress={() => selectEvent(event)} className="rounded bg-accent p-1"><Text className="text-xs" numberOfLines={2}>{common.has(event.key + event.sourceId) ? '◆ ' : ''}{event.title}</Text></Pressable>)}
  </View>;
}
function TimeAxis({ zoom }: { zoom: number }) {
  return <View style={{ width: 48 }}>{Array.from({ length: 24 }, (_, hour) => <Text key={hour} className="absolute right-2 text-xs text-muted-foreground" style={{ top: hour * 60 * zoom + 2 }}>{String(hour).padStart(2, '0')}:00</Text>)}</View>;
}
function DayColumn({ date, width, zoom, events, common, selectEvent }: { date: string; width: number; zoom: number; events: DisplayEvent[]; common: Set<string>; selectEvent: Props['selectEvent'] }) {
  return <View className="border-l border-border" style={{ width }}>
    {Array.from({ length: 24 }, (_, hour) => <View key={hour} className="absolute w-full border-t border-border/40" style={{ top: hour * 60 * zoom }} />)}
    {dayLayout(events, date).map(item => <EventBlock key={item.event.key + item.event.sourceId} item={item} zoom={zoom} shared={common.has(item.event.key + item.event.sourceId)} selectEvent={selectEvent} />)}
  </View>;
}
function EventBlock({ item, zoom, shared, selectEvent }: { item: PositionedEvent; zoom: number; shared: boolean; selectEvent: Props['selectEvent'] }) {
  const event = item.event;
  return <Pressable accessibilityRole="button" accessibilityLabel={`${event.title}, ${clockTime(event.start)}, terem: ${event.location || 'nincs'}, ${shared ? 'közös óra' : ''}`} onPress={() => selectEvent(event)} className={`absolute overflow-hidden rounded-md border-l-4 p-1.5 ${shared ? 'border-primary bg-accent' : 'border-secondary bg-muted'} ${event.hidden ? 'opacity-40' : ''}`} style={{ top: item.top * zoom, height: item.height * zoom, left: `${item.lane * 100 / item.lanes}%`, width: `${100 / item.lanes}%` }}>
    <Text className="text-xs font-semibold" numberOfLines={2}>{shared ? '◆ ' : ''}{event.title}</Text><Text className="text-xs text-muted-foreground">{clockTime(event.start)}–{clockTime(event.end)}</Text><Text className="text-xs font-semibold" numberOfLines={1}>{event.location}</Text>
  </Pressable>;
}
