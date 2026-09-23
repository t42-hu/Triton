import { cn } from '@/lib/utils';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { Colors } from '@/constants/theme';
import * as SwitchPrimitives from '@rn-primitives/switch';
import { Platform, StyleSheet, type PressableStateCallbackType, type ViewStyle } from 'react-native';

function Switch({
  className,
  style,
  ...props
}: React.ComponentProps<typeof SwitchPrimitives.Root>) {
  const colorScheme = useColorScheme();
  const theme = Colors[colorScheme];
  const trackStyle: ViewStyle = { width: 36, height: 22, borderWidth: 1, borderRadius: 11, backgroundColor: props.checked ? theme.textSecondary : theme.backgroundSelected, borderColor: props.checked ? theme.textSecondary : `${theme.text}66` };
  const rootStyle = typeof style === 'function' ? (state: PressableStateCallbackType) => StyleSheet.flatten([trackStyle, style(state)]) : StyleSheet.flatten([trackStyle, style]);
  const thumbColor = colorScheme === 'dark' && props.checked ? theme.background : Colors.light.background;
  return (
    <SwitchPrimitives.Root
      hitSlop={12}
      style={rootStyle}
      className={cn(
        'relative shrink-0',
        Platform.select({
          web: 'inline-flex cursor-pointer outline-none focus-visible:ring-1 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:cursor-not-allowed',
        }),
        props.disabled && 'opacity-50',
        className
      )}
      {...props}>
      <SwitchPrimitives.Thumb
        style={{ width: 16, height: 16, borderRadius: 8, backgroundColor: thumbColor, position: 'absolute', top: 2, left: props.checked ? 16 : 2 }}
        className="pointer-events-none"
      />
    </SwitchPrimitives.Root>
  );
}

export { Switch };
