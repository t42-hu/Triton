import { useRef, useState } from 'react';
import { Keyboard, Platform, Pressable, View } from 'react-native';
import { DateTimePicker } from '@expo/ui/community/datetime-picker';
import { useColorScheme } from 'nativewind';
import { Modal as PanelModal } from './controls';
import { CalendarDays, Check, Clock3 } from 'lucide-react-native';
import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { today, validDate } from '../domain/time';

type PickerMode = 'date' | 'time';

function pickerValue(value: string): Date {
  const date = validDate(value.slice(0, 10)) ? value.slice(0, 10) : today();
  const [year, month, day] = date.split('-').map(Number);
  const [hour, minute] = value.slice(11, 16).split(':').map(Number);
  return new Date(year, month - 1, day, hour || 0, minute || 0);
}

function selectedValue(value: string, mode: PickerMode, selected: Date): string {
  const date = [selected.getFullYear(), String(selected.getMonth() + 1).padStart(2, '0'), String(selected.getDate()).padStart(2, '0')].join('-');
  const time = [selected.getHours(), selected.getMinutes()].map(part => String(part).padStart(2, '0')).join(':');
  return mode === 'date' ? `${date}T${value.slice(11, 16)}` : `${value.slice(0, 10)}T${time}`;
}

function PickerField({ mode, label, value, open, onChange }: { mode: PickerMode; label: string; value: string; open: () => void; onChange: (value: string) => void }) {
  const input = useRef<HTMLInputElement>(null);
  function activate() {
    Keyboard.dismiss();
    if (Platform.OS !== 'web') return open();
    if (input.current?.showPicker) return input.current.showPicker();
    input.current?.click();
  }
  return <View className={`relative min-w-0 ${mode === 'date' ? 'flex-[3]' : 'flex-[2]'}`}>
    <Pressable accessibilityRole="button" accessibilityLabel={`${label} ${mode === 'date' ? 'dátuma' : 'időpontja'}`} accessibilityHint={mode === 'date' ? 'Naptár megnyitása' : 'Időválasztó megnyitása'} className="h-11 flex-row items-center gap-2 rounded-lg border border-input bg-background px-3 hover:bg-primary/5 active:bg-primary/10 dark:bg-input/30" onPress={activate}>
      <Icon as={mode === 'date' ? CalendarDays : Clock3} size={18} className="text-primary" />
      <Text className="min-w-0 flex-1 text-base" numberOfLines={1}>{value || (mode === 'date' ? 'Dátum' : 'Időpont')}</Text>
    </Pressable>
    {Platform.OS === 'web' ? <input ref={input} type={mode} value={value} onChange={event => onChange(event.currentTarget.value)} aria-label={`${label} ${mode === 'date' ? 'naptára' : 'időválasztója'}`} tabIndex={-1} style={{ position: 'absolute', width: 1, height: 1, opacity: 0, pointerEvents: 'none' }} /> : null}
  </View>;
}

function NativePicker({ mode, value, onChange, close }: { mode: PickerMode; value: string; onChange: (value: string) => void; close: () => void }) {
  const { colorScheme } = useColorScheme();
  const isAndroid = Platform.OS === 'android';
  const picker = <DateTimePicker value={pickerValue(value)} mode={mode} display={isAndroid ? 'default' : mode === 'date' ? 'inline' : 'spinner'} is24Hour locale="hu_HU" themeVariant={colorScheme === 'dark' ? 'dark' : 'light'} positiveButton={{ label: 'Kész' }} negativeButton={{ label: 'Mégse' }} onValueChange={(_, selected) => { onChange(selectedValue(value, mode, selected)); if (isAndroid) close(); }} onDismiss={close} />;
  if (isAndroid) return picker;
  return <PanelModal pickerMotion title={mode === 'date' ? 'Dátum kiválasztása' : 'Idő beállítása'} close={close}>
    {picker}
    <Button accessibilityLabel="Választás kész" onPress={close}><Icon as={Check} size={16} className="text-primary-foreground" /><Text>Kész</Text></Button>
  </PanelModal>;
}

export function DateTimeField({ label, value, onChange, allDay = false }: { label: string; value: string; onChange: (value: string) => void; allDay?: boolean }) {
  const [pickerMode, setPickerMode] = useState<PickerMode | null>(null);
  const [date = '', time = ''] = value.split('T');
  return <View className="gap-2">
    <Text className="text-sm font-semibold">{label}</Text>
    <View className="flex-row gap-2">
      <PickerField mode="date" label={label} value={date} open={() => setPickerMode('date')} onChange={nextDate => onChange(`${nextDate}T${time}`)} />
      {allDay ? null : <PickerField mode="time" label={label} value={time} open={() => setPickerMode('time')} onChange={nextTime => onChange(`${date}T${nextTime}`)} />}
    </View>
    {Platform.OS !== 'web' && pickerMode ? <NativePicker mode={pickerMode} value={value} onChange={onChange} close={() => setPickerMode(null)} /> : null}
  </View>;
}

/** Uses the same calendar control for date-only ranges and recurrence boundaries. */
export function DateField({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return <DateTimeField label={label} value={`${value}T00:00`} onChange={next => onChange(next.slice(0, 10))} allDay />;
}
