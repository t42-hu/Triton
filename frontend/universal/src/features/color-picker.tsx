import { AnimatedDisclosure } from './animated-disclosure';
import { useState } from 'react';
import { View } from 'react-native';
import { Check, ChevronRight, Clock, SlidersHorizontal } from 'lucide-react-native';
import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { Action, Field, Modal } from './controls';
import { EVENT_PALETTE, isHexColor } from '../domain/event-colors';

const COLOR_NAMES = ['Kék', 'Zöld', 'Sárga', 'Korall', 'Lila', 'Türkiz', 'Narancs'];
type ColorFieldProps = { label: string; value: string; onChange: (color: string) => void };

function colorName(color: string): string {
  if (!color) return 'Alapértelmezett';
  return COLOR_NAMES[EVENT_PALETTE.indexOf(color.toLowerCase())] ?? 'Egyéni szín';
}

/** Presents the same named palette and explicit draft confirmation on every platform. */
export function ColorField({ label, value, onChange }: ColorFieldProps) {
  const [isOpen, setIsOpen] = useState(false);
  return <View className="gap-2">
    <Text className="text-sm font-medium">{label}</Text>
    <Button variant="outline" className="h-14 justify-start border-border bg-background" accessibilityLabel={`${label}: ${colorName(value)}`} onPress={() => setIsOpen(true)}>
      <View className="h-8 w-8 rounded-lg border border-border" style={isHexColor(value) ? { backgroundColor: value } : undefined} />
      <Text className="min-w-0 flex-1">{colorName(value)}</Text>
      <Icon as={ChevronRight} size={18} className="text-muted-foreground" />
    </Button>
    {isOpen ? <ColorPickerDialog label={label} value={value} onChange={onChange} close={() => setIsOpen(false)} /> : null}
  </View>;
}

function ColorPickerDialog({ label, value, onChange, close }: ColorFieldProps & { close: () => void }) {
  const [draftColor, setDraftColor] = useState(value || EVENT_PALETTE[0]);
  const [isCustomOpen, setIsCustomOpen] = useState(Boolean(value && !EVENT_PALETTE.includes(value.toLowerCase())));
  const isValid = isHexColor(draftColor);
  function applyColor() {
    if (!isValid) return;
    onChange(draftColor.toLowerCase());
    close();
  }
  return <Modal title="Szín kiválasztása" description={label} maxWidth={420} close={close} footer={<Action icon={Check} disabled={!isValid} onPress={applyColor}>Kész</Action>}>
    <ColorPreview color={isValid ? draftColor : EVENT_PALETTE[0]} />
    <View className="gap-2">
      <Text className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Színpaletta</Text>
      <View className="flex-row flex-wrap gap-2">
        {EVENT_PALETTE.map((color, index) => <ColorPreset key={color} color={color} name={COLOR_NAMES[index]} selected={draftColor.toLowerCase() === color} onSelect={setDraftColor} />)}
      </View>
    </View>
    <Action secondary icon={SlidersHorizontal} expanded={isCustomOpen} revealOnExpand={false} onPress={() => setIsCustomOpen(!isCustomOpen)}>Egyéni szín</Action>
    <AnimatedDisclosure expanded={isCustomOpen} gap={20}><View className="gap-2">
      <Field label="Színkód" value={draftColor} onChange={setDraftColor} placeholder="#93b4f5" />
      <Text accessibilityRole={isValid ? undefined : 'alert'} className={isValid ? 'text-xs text-muted-foreground' : 'text-xs text-destructive'}>{isValid ? 'Hatjegyű színkódot is megadhatsz.' : 'Írj be hatjegyű színkódot, például #93b4f5.'}</Text>
    </View></AnimatedDisclosure>
  </Modal>;
}

function ColorPreset({ color, name, selected, onSelect }: { color: string; name: string; selected: boolean; onSelect: (color: string) => void }) {
  return <Button variant="outline" className={selected ? 'h-12 justify-start border-primary bg-primary/10' : 'h-12 justify-start border-border bg-background'} style={{ width: '47%', paddingHorizontal: 10 }} accessibilityLabel={name} accessibilityState={{ selected }} onPress={() => onSelect(color)}>
    <View style={{ backgroundColor: color }} className="h-6 w-6 items-center justify-center rounded-full">
      {selected ? <Icon as={Check} size={15} color="#111827" /> : null}
    </View>
    <Text className="text-sm">{name}</Text>
  </Button>;
}

function ColorPreview({ color }: { color: string }) {
  return <View className="gap-2">
    <Text className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Így jelenik meg</Text>
    <View className="gap-2 rounded-xl border bg-background p-4" style={{ borderColor: color }}>
      <View className="flex-row items-center gap-2"><Icon as={Clock} size={17} color={color} /><Text style={{ color }} className="text-sm font-semibold">12:00–13:30</Text></View>
      <Text className="font-medium">Esemény előnézete</Text>
    </View>
  </View>;
}
