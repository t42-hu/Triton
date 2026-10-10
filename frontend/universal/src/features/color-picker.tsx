import { AnimatedDisclosure } from './animated-disclosure';
import { useState } from 'react';
import { View } from 'react-native';
import { Check, ChevronRight, Clock, SlidersHorizontal, Trash2 } from 'lucide-react-native';
import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { useColorScheme } from 'nativewind';
import { readableColor } from '../domain/color-contrast';
import { useApp } from './app-state';
import { GradientColorPicker } from './gradient-color-picker';
import { Action, Modal } from './controls';
import { EVENT_PALETTE, isHexColor } from '../domain/event-colors';

const COLOR_NAMES = ['Kék', 'Zöld', 'Sárga', 'Korall', 'Lila', 'Türkiz', 'Narancs'];
type ColorFieldProps = { label: string; value: string; onChange: (color: string) => void; hideLabel?: boolean };

function colorName(color: string): string {
  if (!color) return 'Alapértelmezett';
  return COLOR_NAMES[EVENT_PALETTE.indexOf(color.toLowerCase())] ?? 'Egyéni szín';
}

/** Presents the same named palette and explicit draft confirmation on every platform. */
export function ColorField({ label, value, onChange, hideLabel = false }: ColorFieldProps) {
  const [isOpen, setIsOpen] = useState(false);
  return <View className="gap-2">
    {!hideLabel ? <Text className="text-sm font-medium">{label}</Text> : null}
    <Button variant="outline" className="h-11 justify-start border-border bg-background px-3" accessibilityLabel={`${label}: ${colorName(value)}`} onPress={() => setIsOpen(true)}>
      <View className="h-5 w-5 rounded border border-border" style={isHexColor(value) ? { backgroundColor: value } : undefined} />
      <Text className="min-w-0 flex-1">{colorName(value)}</Text>
      <Icon as={ChevronRight} size={18} className="text-muted-foreground" />
    </Button>
    {isOpen ? <ColorPickerDialog label={label} value={value} onChange={onChange} close={() => setIsOpen(false)} /> : null}
  </View>;
}

function ColorPickerDialog({ label, value, onChange, close }: ColorFieldProps & { close: () => void }) {
  const app = useApp();
  const [error, setError] = useState('');
  const [draftColor, setDraftColor] = useState(value || EVENT_PALETTE[0]);
  const [isCustomOpen, setIsCustomOpen] = useState(Boolean(value && !EVENT_PALETTE.includes(value.toLowerCase())));
  const isValid = isHexColor(draftColor);
  const customColors = app.savedColors.filter(color => !EVENT_PALETTE.includes(color.toLowerCase()));
  const palette = [...EVENT_PALETTE, ...customColors];
  function removeColor(color: string) { void app.removePaletteColor(color).catch(error => setError(String(error))); }
  function applyColor() {
    if (!isValid) return;
    onChange(draftColor.toLowerCase());
    close();
  }
  return <Modal title="Szín kiválasztása" description={label} maxWidth={420} close={close} footer={<Action icon={Check} disabled={!isValid} onPress={applyColor}>Kész</Action>}>
    <ColorPreview color={isValid ? draftColor : EVENT_PALETTE[0]} />
    <View className="gap-2">
      <View className="flex-row flex-wrap gap-2">
        {palette.map((color, index) => <ColorPreset key={color} color={color} name={COLOR_NAMES[index] ?? `Egyéni ${index - EVENT_PALETTE.length + 1}`} selected={draftColor.toLowerCase() === color} onSelect={setDraftColor} remove={app.savedColors.includes(color) ? () => removeColor(color) : undefined} />)}
      </View>
    </View>
    <Action secondary icon={SlidersHorizontal} expanded={isCustomOpen} revealOnExpand={false} onPress={() => setIsCustomOpen(!isCustomOpen)}>Egyéni szín</Action>
    <AnimatedDisclosure expanded={isCustomOpen} gap={20}><GradientColorPicker color={draftColor} onChange={setDraftColor} />
      <Action secondary disabled={app.savedColors.includes(draftColor.toLowerCase())} onPress={() => { void app.savePaletteColor(draftColor).catch(error => setError(String(error))); }}>{app.savedColors.includes(draftColor.toLowerCase()) ? 'Elmentve' : 'Mentés a palettára'}</Action>
    </AnimatedDisclosure>
    {error ? <Text accessibilityRole="alert" className="text-destructive">{error}</Text> : null}
  </Modal>;
}

function ColorPreset({ color, name, selected, onSelect, remove }: { color: string; name: string; selected: boolean; onSelect: (color: string) => void; remove?: () => void }) {
  return <View className={`flex-row items-center rounded-lg border ${selected ? 'border-primary bg-primary/10' : 'border-border bg-background'}`} style={{ width: '47%' }}><Button variant="ghost" className="h-12 min-w-0 flex-1 justify-start px-2" accessibilityLabel={name} accessibilityState={{ selected }} onPress={() => onSelect(color)}>
    <View style={{ backgroundColor: color }} className="h-6 w-6 items-center justify-center rounded-full">
      {selected ? <Icon as={Check} size={15} color="#111827" /> : null}
    </View>
    <Text className="shrink text-sm" numberOfLines={1}>{name}</Text>
  </Button>{remove ? <Button variant="ghost" size="icon" accessibilityLabel={`${name} mentett szín törlése`} onPress={remove}><Icon as={Trash2} size={16} className="text-muted-foreground" /></Button> : null}</View>;
}

function ColorPreview({ color }: { color: string }) {
  color = readableColor(color, useColorScheme().colorScheme === 'dark') ?? color;
  return <View className="gap-2">
    <View className="gap-2 rounded-xl border bg-background p-4" style={{ borderColor: color }}>
      <View className="flex-row items-center gap-2"><Icon as={Clock} size={17} color={color} /><Text style={{ color }} className="text-sm font-semibold">12:00–13:30</Text></View>
      <Text className="font-medium">Esemény előnézete</Text>
    </View>
  </View>;
}
