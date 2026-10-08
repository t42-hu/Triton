import { useState } from 'react';
import { Platform, View } from 'react-native';
import type { LucideIcon } from 'lucide-react-native';
import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';

export type RowAction = { label: string; accessibilityLabel?: string; icon: LucideIcon; iconClassName?: string; onPress: () => void; secondary?: boolean; quiet?: boolean; disabled?: boolean };

/** Uses measured labels so the entire row switches to icons before any label is clipped. */
export function ActionRow({ actions }: { actions: RowAction[] }) {
  const [width, setWidth] = useState(0);
  const [labelWidths, setLabelWidths] = useState<Record<string, number>>({});
  function measureLabel(label: string, measured: number) { setLabelWidths(current => current[label] === measured ? current : { ...current, [label]: measured }); }
  const showLabels = actions.every(action => labelWidths[action.label] !== undefined) && width >= Math.max(...actions.map(action => labelWidths[action.label] + 57)) * actions.length + (actions.length - 1) * 8;
  const minimumWidth = Platform.OS === 'android' ? 48 : 44;
  return <View onLayout={event => setWidth(event.nativeEvent.layout.width)} className="relative w-full flex-row flex-wrap gap-2">
    <View pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants" aria-hidden style={{ position: 'absolute', width: 10000, opacity: 0, flexDirection: 'row' }}>
      {actions.map(action => <Text key={action.label} className="text-sm font-medium" onLayout={event => measureLabel(action.label, event.nativeEvent.layout.width)}>{action.label}</Text>)}
    </View>
    {actions.map(action => <Button key={action.label} disabled={action.disabled} accessibilityLabel={action.accessibilityLabel ?? action.label} variant={action.quiet ? 'ghost' : action.secondary ? 'outline' : 'default'} className="flex-1" style={{ minWidth: minimumWidth, paddingHorizontal: showLabels ? 16 : 0 }} onPress={action.onPress}>
      <Icon as={action.icon} size={17} className={action.iconClassName ?? (action.secondary || action.quiet ? 'text-foreground' : 'text-primary-foreground')} />
      {showLabels ? <Text numberOfLines={1}>{action.label}</Text> : null}
    </Button>)}
  </View>;
}
