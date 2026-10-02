import { cn } from '@/lib/utils';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { Colors } from '@/constants/theme';
import * as SwitchPrimitives from '@rn-primitives/switch';
import { Platform, StyleSheet, type PressableStateCallbackType, type ViewStyle } from 'react-native';
import Animated, { interpolateColor, useAnimatedStyle } from 'react-native-reanimated';
import { useMotionValue } from '@/hooks/use-motion-value';

function Switch({
  className,
  style,
  ...props
}: React.ComponentProps<typeof SwitchPrimitives.Root>) {
  const colorScheme = useColorScheme();
  const theme = Colors[colorScheme];
  const progress = useMotionValue(props.checked ? 1 : 0);
  const animatedTrack = useAnimatedStyle(() => ({ backgroundColor: interpolateColor(progress.value, [0, 1], [theme.backgroundSelected, theme.textSecondary]), borderColor: interpolateColor(progress.value, [0, 1], [`${theme.text}66`, theme.textSecondary]) }));
  const animatedThumb = useAnimatedStyle(() => ({ transform: [{ translateX: progress.value * 14 }], backgroundColor: interpolateColor(progress.value, [0, 1], ['#FFFFFF', colorScheme === 'dark' ? theme.background : '#FFFFFF']) }));
  const trackStyle: ViewStyle = { width: 36, height: 22, borderWidth: 1, borderRadius: 11, backgroundColor: props.checked ? theme.textSecondary : theme.backgroundSelected, borderColor: props.checked ? theme.textSecondary : `${theme.text}66` };
  const rootStyle = typeof style === 'function' ? (state: PressableStateCallbackType) => StyleSheet.flatten([trackStyle, style(state)]) : StyleSheet.flatten([trackStyle, style]);
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
      <Animated.View pointerEvents="none" style={[{ position: 'absolute', inset: -1, borderRadius: 11, borderWidth: 1 }, animatedTrack]} />
      <Animated.View pointerEvents="none" style={[{ width: 16, height: 16, borderRadius: 8, borderWidth: 1, borderColor: `${theme.textSecondary}99`, position: 'absolute', top: 2, left: 2 }, animatedThumb]} />
    </SwitchPrimitives.Root>
  );
}

export { Switch };
