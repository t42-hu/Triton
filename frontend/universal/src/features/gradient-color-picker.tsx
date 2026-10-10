import { useId, useState } from 'react';
import { View, type GestureResponderEvent } from 'react-native';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';
import { Text } from '@/components/ui/text';
import { colorHsv, hsvColor } from '../domain/color-contrast';

const clamp = (value: number) => Math.max(0, Math.min(1, value));
/** The same draggable saturation/value plane and hue strip work on touch and web. */
export function GradientColorPicker({ color, onChange }: { color: string; onChange: (color: string) => void }) {
  const id = useId().replace(/:/g, '');
  const [width, setWidth] = useState(300);
  const [selectedHue, setSelectedHue] = useState(colorHsv(color).hue);
  const parsed = colorHsv(color);
  const hsv = { ...parsed, hue: parsed.saturation && parsed.value ? parsed.hue : selectedHue };
  function plane(event: GestureResponderEvent) { onChange(hsvColor(hsv.hue, clamp(event.nativeEvent.locationX / width), 1 - clamp(event.nativeEvent.locationY / 160))); }
  function hue(event: GestureResponderEvent) { const next = clamp(event.nativeEvent.locationX / width) * 359.9; setSelectedHue(next); onChange(hsvColor(next, hsv.saturation, hsv.value)); }
  return <View className="gap-3">
    <Text className="text-sm">Húzd a jelölőt a kívánt árnyalatra.</Text>
    <View accessibilityLabel="Telítettség és fényerő" onLayout={event => setWidth(event.nativeEvent.layout.width)} onStartShouldSetResponder={() => true} onMoveShouldSetResponder={() => true} onResponderGrant={plane} onResponderMove={plane} onResponderTerminationRequest={() => false} style={{ height: 160, borderRadius: 12, overflow: 'hidden' }}>
      <View pointerEvents="none" style={{ flex: 1 }}><Svg width="100%" height="100%"><Defs>
        <LinearGradient id={`${id}white`} x1="0%" x2="100%"><Stop offset="0" stopColor="white" /><Stop offset="1" stopColor="white" stopOpacity={0} /></LinearGradient>
        <LinearGradient id={`${id}black`} x1="0%" y1="0%" x2="0%" y2="100%"><Stop offset="0" stopColor="black" stopOpacity={0} /><Stop offset="1" stopColor="black" /></LinearGradient>
      </Defs><Rect width="100%" height="100%" fill={hsvColor(hsv.hue, 1, 1)} /><Rect width="100%" height="100%" fill={`url(#${id}white)`} /><Rect width="100%" height="100%" fill={`url(#${id}black)`} /></Svg>
      <View style={{ position: 'absolute', left: hsv.saturation * (width - 18), top: (1 - hsv.value) * 142, width: 18, height: 18, borderRadius: 9, borderWidth: 3, borderColor: 'white', backgroundColor: color, boxShadow: '0 0 0 1px #111827' }} /></View>
    </View>
    <View accessibilityLabel="Színárnyalat" onStartShouldSetResponder={() => true} onMoveShouldSetResponder={() => true} onResponderGrant={hue} onResponderMove={hue} onResponderTerminationRequest={() => false} style={{ height: 32, borderRadius: 8, overflow: 'hidden' }}>
      <View pointerEvents="none" style={{ flex: 1 }}><Svg width="100%" height="100%"><Defs><LinearGradient id={`${id}hue`} x1="0%" x2="100%">{['#ff0000', '#ffff00', '#00ff00', '#00ffff', '#0000ff', '#ff00ff', '#ff0000'].map((stop, index) => <Stop key={index} offset={index / 6} stopColor={stop} />)}</LinearGradient></Defs><Rect width="100%" height="100%" fill={`url(#${id}hue)`} /></Svg><View style={{ position: 'absolute', left: hsv.hue / 360 * (width - 10), top: 0, width: 10, height: 32, borderWidth: 2, borderColor: 'white', borderRadius: 5 }} /></View>
    </View>
  </View>;
}
