import { useRef, useState } from 'react';
import { Modal, Platform, Pressable, View } from 'react-native';
import { DateTimePicker } from '@expo/ui/community/datetime-picker';
import { useColorScheme } from 'nativewind';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CalendarDays, Check, Clock3 } from 'lucide-react-native';
import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { Input } from '@/components/ui/input';
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

function PickerIcon({ mode, label, value, open, onChange }: { mode: PickerMode; label: string; value: string; open: () => void; onChange: (value: string) => void }) {
  const input = useRef<HTMLInputElement>(null);
  function activate() {
    if (Platform.OS !== 'web') return open();
    if (input.current?.showPicker) return input.current.showPicker();
    input.current?.click();
  }
  return <View className="relative">
    <Pressable accessibilityRole="button" accessibilityLabel={`${label} ${mode === 'date' ? 'naptár megnyitása' : 'időválasztó megnyitása'}`} className="h-11 w-7 items-center justify-center" onPress={activate}>
      <Icon as={mode === 'date' ? CalendarDays : Clock3} size={18} className="text-primary" />
    </Pressable>
    {Platform.OS === 'web' ? <input ref={input} type={mode} value={value} onChange={event => onChange(event.currentTarget.value)} aria-label={`${label} ${mode === 'date' ? 'naptára' : 'időválasztója'}`} tabIndex={-1} style={{ position: 'absolute', width: 1, height: 1, opacity: 0, pointerEvents: 'none' }} /> : null}
  </View>;
}

function NativePicker({ mode, value, onChange, close }: { mode: PickerMode; value: string; onChange: (value: string) => void; close: () => void }) {
  const { colorScheme } = useColorScheme();
  const { bottom } = useSafeAreaInsets();
  const isAndroid = Platform.OS === 'android';
  const picker = <DateTimePicker value={pickerValue(value)} mode={mode} display={isAndroid ? 'default' : mode === 'date' ? 'inline' : 'spinner'} is24Hour locale="hu_HU" themeVariant={colorScheme === 'dark' ? 'dark' : 'light'} positiveButton={{ label: 'Kész' }} negativeButton={{ label: 'Mégse' }} onValueChange={(_, selected) => { onChange(selectedValue(value, mode, selected)); if (isAndroid) close(); }} onDismiss={close} />;
  if (isAndroid) return picker;
  return <Modal transparent animationType="slide" presentationStyle="overFullScreen" onRequestClose={close}>
    <View className="flex-1 justify-end bg-black/50"><Pressable accessibilityLabel="Választó bezárása" className="flex-1" onPress={close} />
      <View className="gap-2 rounded-t-3xl border-t border-border bg-background px-5 pt-4" style={{ paddingBottom: Math.max(bottom, 16) }}>
        <View className="flex-row items-center justify-between"><Text className="text-base font-semibold">{mode === 'date' ? 'Dátum kiválasztása' : 'Idő beállítása'}</Text>
          <Button accessibilityLabel="Választás kész" variant="ghost" className="h-9 gap-1 px-2" onPress={close}><Icon as={Check} size={16} className="text-primary" /><Text className="text-sm">Kész</Text></Button>
        </View>
        {picker}
      </View>
    </View>
  </Modal>;
}

export function DateTimeField({ label, value, onChange, allDay = false }: { label: string; value: string; onChange: (value: string) => void; allDay?: boolean }) {
  const [pickerMode, setPickerMode] = useState<PickerMode | null>(null);
  const [date = '', time = ''] = value.split('T');
  return <View className="gap-2">
    <Text className="text-sm font-semibold">{label}</Text>
    <View className="flex-row gap-2">
      <View className="min-w-0 flex-[3] flex-row items-center gap-1 rounded-lg border border-input bg-background px-2 dark:bg-input/30">
        <PickerIcon mode="date" label={label} value={date} open={() => setPickerMode('date')} onChange={nextDate => onChange(`${nextDate}T${time}`)} />
        <Input accessibilityLabel={`${label} dátuma`} value={date} onChangeText={nextDate => onChange(`${nextDate}T${time}`)} editable={Platform.OS === 'web'} placeholder="ÉÉÉÉ-HH-NN" keyboardType="numbers-and-punctuation" maxLength={10} autoCapitalize="none" className="h-11 min-w-0 flex-1 border-0 bg-transparent px-0 opacity-100 shadow-none dark:bg-transparent" />
      </View>
      {allDay ? null : <View className="min-w-0 flex-[2] flex-row items-center gap-1 rounded-lg border border-input bg-background px-2 dark:bg-input/30">
        <PickerIcon mode="time" label={label} value={time} open={() => setPickerMode('time')} onChange={nextTime => onChange(`${date}T${nextTime}`)} />
        <Input accessibilityLabel={`${label} időpontja`} value={time} onChangeText={nextTime => onChange(`${date}T${nextTime}`)} editable={Platform.OS === 'web'} placeholder="ÓÓ:PP" keyboardType="numbers-and-punctuation" maxLength={5} autoCapitalize="none" className="h-11 min-w-0 flex-1 border-0 bg-transparent px-0 opacity-100 shadow-none dark:bg-transparent" />
      </View>}
    </View>
    {Platform.OS !== 'web' && pickerMode ? <NativePicker mode={pickerMode} value={value} onChange={onChange} close={() => setPickerMode(null)} /> : null}
  </View>;
}
