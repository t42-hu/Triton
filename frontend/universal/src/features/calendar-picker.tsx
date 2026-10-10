import { useRef, useState } from 'react';
import { View } from 'react-native';
import { Gesture, GestureDetector, type PanGestureHandlerEventPayload } from 'react-native-gesture-handler';
import { Check, ChevronLeft, ChevronRight } from 'lucide-react-native';
import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { Modal } from './controls';
import { today, validDate } from '@/domain/time';
import { calendarDays, shiftCalendarMonth } from '@/domain/calendar-picker';
type PickerProps = { value: string; onChange: (value: string) => void; close: () => void };
const weekdays = ['H', 'K', 'Sze', 'Cs', 'P', 'Szo', 'V'];

export function CalendarPicker({ value, onChange, close }: PickerProps) {
  const [currentDate] = useState(today);
  const [selected, setSelected] = useState(validDate(value) ? value : currentDate);
  const [month, setMonth] = useState(selected.slice(0, 7));
  const monthLabel = new Intl.DateTimeFormat('hu-HU', { year: 'numeric', month: 'long', timeZone: 'UTC' }).format(new Date(`${month}-01T12:00:00Z`));
  const blockedUntil = useRef(0);
  const swiping = useRef(false);
  // Gesture callbacks execute after recognition on the JS thread, never during render.
  /* eslint-disable react-hooks/refs, react-hooks/purity */
  function swipeStart() { swiping.current = true; blockedUntil.current = Date.now() + 10000; }
  function swipeEnd(event: PanGestureHandlerEventPayload) { if (Math.abs(event.translationX) >= 40) setMonth(shiftCalendarMonth(month, event.translationX < 0 ? 1 : -1)); }
  function swipeFinish() {
    // A plain tap also finalizes the pan recognizer, without ever starting a swipe.
    if (!swiping.current) return;
    swiping.current = false; blockedUntil.current = Date.now() + 250;
  }
  const swipe = Gesture.Pan().activeOffsetX([-20, 20]).failOffsetY([-16, 16]).runOnJS(true)
    .onStart(swipeStart).onEnd(swipeEnd).onFinalize(swipeFinish);
  /* eslint-enable react-hooks/refs, react-hooks/purity */
  function select(date: string) { if (Date.now() < blockedUntil.current) return; setSelected(date); setMonth(date.slice(0, 7)); }
  function finish() { onChange(selected); close(); }
  function selectToday() { select(currentDate); }
  return <Modal pickerMotion title="Dátum kiválasztása" maxWidth={440} close={close}>
    <GestureDetector gesture={swipe} touchAction="pan-y"><View className="w-full max-w-[360px] self-center gap-3">
      <View className="flex-row items-center justify-between gap-3"><Text accessibilityRole="header" accessibilityLiveRegion="polite" className="flex-1 text-lg font-semibold">{monthLabel}</Text><Button variant="ghost" size="icon" accessibilityLabel="Előző hónap" onPress={() => setMonth(shiftCalendarMonth(month, -1))} className="border-0 bg-transparent"><Icon as={ChevronLeft} size={18} /></Button><Button variant="ghost" size="icon" accessibilityLabel="Következő hónap" onPress={() => setMonth(shiftCalendarMonth(month, 1))} className="border-0 bg-transparent"><Icon as={ChevronRight} size={18} /></Button></View>
      <View className="flex-row">{weekdays.map(day => <View key={day} style={{ width: '14.285714%' }} className="items-center"><Text className="text-xs font-medium text-muted-foreground">{day}</Text></View>)}</View>
      <View testID="calendar-grid" className="flex-row flex-wrap">{calendarDays(month).map(date => <CalendarDay key={date} date={date} month={month} selected={selected} today={currentDate} select={select} />)}</View>
      <Button variant="link" className="h-9" onPress={selectToday} accessibilityLabel="Mai dátum kiválasztása"><Text>Ma</Text></Button>
    </View></GestureDetector><Button onPress={finish} accessibilityLabel="Választás kész"><Icon as={Check} size={16} className="text-primary-foreground" /><Text>Kész</Text></Button>
  </Modal>;
}

function CalendarDay({ date, month, selected, today: currentDate, select }: { date: string; month: string; selected: string; today: string; select: (date: string) => void }) {
  const isSelected = date === selected;
  const isCurrentMonth = date.startsWith(month);
  const label = new Intl.DateTimeFormat('hu-HU', { dateStyle: 'full', timeZone: 'UTC' }).format(new Date(`${date}T12:00:00Z`));
  function press() { select(date); }
  return <View style={{ width: '14.285714%' }} className="items-center py-0.5"><Button accessibilityLabel={label} accessibilityState={{ selected: isSelected }} aria-pressed={isSelected} variant={isSelected ? 'default' : 'ghost'} onPress={press} className={`h-11 w-11 rounded-full p-0 ${isSelected ? '' : 'border-0 bg-transparent'} ${date === currentDate && !isSelected ? 'border border-primary/50' : ''}`}><Text className={isSelected ? 'text-primary-foreground' : isCurrentMonth ? 'text-foreground' : 'text-muted-foreground/50'}>{Number(date.slice(8))}</Text></Button></View>;
}
