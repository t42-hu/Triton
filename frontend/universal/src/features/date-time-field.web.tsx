import { useState, type KeyboardEvent } from 'react';
import { View } from 'react-native';
import { CalendarDays, Check, ChevronLeft, ChevronRight, ChevronUp, ChevronDown, Clock3 } from 'lucide-react-native';
import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { Modal } from './controls';
import { today, validDate } from '@/domain/time';
import { calendarDays, shiftCalendarMonth } from '@/domain/calendar-picker';

type PickerMode = 'date' | 'time';
type PickerProps = { value: string; onChange: (value: string) => void; close: () => void };
const weekdays = ['H', 'K', 'Sze', 'Cs', 'P', 'Szo', 'V'];

/** Uses themed web panels for the same date and time actions offered on native platforms. */
export function DateTimeField({ label, value, onChange, allDay = false }: { label: string; value: string; onChange: (value: string) => void; allDay?: boolean }) {
  const [mode, setMode] = useState<PickerMode | null>(null);
  const [date = '', time = ''] = value.split('T');
  function changeDate(next: string) { onChange(`${next}T${time}`); }
  function changeTime(next: string) { onChange(`${date}T${next}`); }
  function close() { setMode(null); }
  return <View className="gap-2"><Text className="text-sm font-semibold">{label}</Text><View className="flex-row gap-2">
    <PickerButton mode="date" label={label} value={date} open={() => setMode('date')} />
    {allDay ? null : <PickerButton mode="time" label={label} value={time} open={() => setMode('time')} />}
  </View>{mode === 'date' ? <CalendarPicker value={date} onChange={changeDate} close={close} /> : null}{mode === 'time' ? <TimePicker value={time} onChange={changeTime} close={close} /> : null}</View>;
}

/** Shares the themed calendar with import ranges and recurrence boundaries. */
export function DateField({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return <DateTimeField label={label} value={`${value}T00:00`} onChange={next => onChange(next.slice(0, 10))} allDay />;
}

function PickerButton({ mode, label, value, open }: { mode: PickerMode; label: string; value: string; open: () => void }) {
  return <View className={`min-w-0 ${mode === 'date' ? 'flex-[3]' : 'flex-[2]'}`}><Button variant="ghost" accessibilityLabel={`${label} ${mode === 'date' ? 'dátuma' : 'időpontja'}`} onPress={open} className="h-11 justify-start gap-2 rounded-lg border-input bg-background px-3 dark:bg-input/30"><Icon as={mode === 'date' ? CalendarDays : Clock3} size={18} className="text-primary" /><Text className="min-w-0 flex-1 text-base" numberOfLines={1}>{value || (mode === 'date' ? 'Dátum' : 'Időpont')}</Text></Button></View>;
}

function CalendarPicker({ value, onChange, close }: PickerProps) {
  const [currentDate] = useState(today);
  const [selected, setSelected] = useState(validDate(value) ? value : currentDate);
  const [month, setMonth] = useState(selected.slice(0, 7));
  const monthLabel = new Intl.DateTimeFormat('hu-HU', { year: 'numeric', month: 'long', timeZone: 'UTC' }).format(new Date(`${month}-01T12:00:00Z`));
  function select(date: string) { setSelected(date); setMonth(date.slice(0, 7)); }
  function finish() { onChange(selected); close(); }
  function selectToday() { select(currentDate); }
  return <Modal pickerMotion title="Dátum kiválasztása" maxWidth={440} close={close}>
    <View className="w-full max-w-[360px] self-center gap-3">
      <View className="flex-row items-center justify-between gap-3"><Text accessibilityRole="header" accessibilityLiveRegion="polite" className="flex-1 text-lg font-semibold">{monthLabel}</Text><Button variant="ghost" size="icon" accessibilityLabel="Előző hónap" onPress={() => setMonth(shiftCalendarMonth(month, -1))} className="border-0 bg-transparent"><Icon as={ChevronLeft} size={18} /></Button><Button variant="ghost" size="icon" accessibilityLabel="Következő hónap" onPress={() => setMonth(shiftCalendarMonth(month, 1))} className="border-0 bg-transparent"><Icon as={ChevronRight} size={18} /></Button></View>
      <View className="flex-row">{weekdays.map(day => <View key={day} style={{ width: '14.285714%' }} className="items-center"><Text className="text-xs font-medium text-muted-foreground">{day}</Text></View>)}</View>
      <View testID="web-calendar-grid" className="flex-row flex-wrap">{calendarDays(month).map(date => <CalendarDay key={date} date={date} month={month} selected={selected} today={currentDate} select={select} />)}</View>
      <Button variant="link" className="h-9" onPress={selectToday} accessibilityLabel="Mai dátum kiválasztása"><Text>Ma</Text></Button>
    </View><Button onPress={finish} accessibilityLabel="Választás kész"><Icon as={Check} size={16} className="text-primary-foreground" /><Text>Kész</Text></Button>
  </Modal>;
}

function CalendarDay({ date, month, selected, today: currentDate, select }: { date: string; month: string; selected: string; today: string; select: (date: string) => void }) {
  const isSelected = date === selected;
  const isCurrentMonth = date.startsWith(month);
  const label = new Intl.DateTimeFormat('hu-HU', { dateStyle: 'full', timeZone: 'UTC' }).format(new Date(`${date}T12:00:00Z`));
  function press() { select(date); }
  return <View style={{ width: '14.285714%' }} className="items-center py-0.5"><Button accessibilityLabel={label} accessibilityState={{ selected: isSelected }} aria-pressed={isSelected} variant={isSelected ? 'default' : 'ghost'} onPress={press} className={`h-10 w-10 rounded-full p-0 ${isSelected ? '' : 'border-0 bg-transparent'} ${date === currentDate && !isSelected ? 'border border-primary/50' : ''}`}><Text className={isSelected ? 'text-primary-foreground' : isCurrentMonth ? 'text-foreground' : 'text-muted-foreground/50'}>{Number(date.slice(8))}</Text></Button></View>;
}

function TimePicker({ value, onChange, close }: PickerProps) {
  const [hour, setHour] = useState(value.slice(0, 2) || '00');
  const [minute, setMinute] = useState(value.slice(3, 5) || '00');
  const isValid = /^\d{1,2}$/.test(hour) && Number(hour) < 24 && /^\d{1,2}$/.test(minute) && Number(minute) < 60;
  function finish() { if (!isValid) return; onChange(`${hour.padStart(2, '0')}:${minute.padStart(2, '0')}`); close(); }
  return <Modal pickerMotion title="Idő beállítása" maxWidth={440} close={close}><View className="max-w-[320px] flex-row items-center justify-center gap-4 self-center py-3">
    <TimeInput label="Óra" value={hour} onChange={setHour} max={23} /><Text className="pt-5 text-3xl text-muted-foreground">:</Text><TimeInput label="Perc" value={minute} onChange={setMinute} max={59} />
  </View><Button disabled={!isValid} onPress={finish} accessibilityLabel="Választás kész"><Icon as={Check} size={16} className="text-primary-foreground" /><Text>Kész</Text></Button></Modal>;
}

function TimeInput({ label, value, onChange, max }: { label: string; value: string; onChange: (value: string) => void; max: number }) {
  function step(offset: number) { onChange(String(((Number(value) || 0) + offset + max + 1) % (max + 1)).padStart(2, '0')); }
  function handleKey(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key !== 'ArrowUp' && event.key !== 'ArrowDown') return;
    event.preventDefault(); step(event.key === 'ArrowUp' ? 1 : -1);
  }
  return <View className="gap-2"><Text className="text-center text-sm text-muted-foreground">{label}</Text><View className="relative">
    <input aria-label={label} role="spinbutton" aria-valuemin={0} aria-valuemax={max} aria-valuenow={Number(value)} type="text" inputMode="numeric" maxLength={2} value={value} onKeyDown={handleKey} onChange={event => onChange(event.currentTarget.value)} className="h-20 w-28 rounded-xl border border-input bg-muted/40 pl-3 pr-9 text-center text-3xl tabular-nums text-foreground outline-none focus:border-primary focus:ring-2 focus:ring-primary/20" />
    <View className="absolute bottom-1 right-1 top-1 justify-center gap-1"><Button variant="ghost" accessibilityLabel={`${label} növelése`} onPress={() => step(1)} className="h-8 w-7 rounded-lg border-0 bg-transparent p-0"><Icon as={ChevronUp} size={16} className="text-primary" /></Button><Button variant="ghost" accessibilityLabel={`${label} csökkentése`} onPress={() => step(-1)} className="h-8 w-7 rounded-lg border-0 bg-transparent p-0"><Icon as={ChevronDown} size={16} className="text-primary" /></Button></View>
  </View></View>;
}
