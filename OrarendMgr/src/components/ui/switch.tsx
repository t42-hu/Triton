import { cn } from '@/lib/utils';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { Colors } from '@/constants/theme';
import * as SwitchPrimitives from '@rn-primitives/switch';
import { Platform, type PressableStateCallbackType, type ViewStyle } from 'react-native';

function Switch({
  className,
  style,
  ...props
}: React.ComponentProps<typeof SwitchPrimitives.Root>) {
  const colorScheme = useColorScheme();
  const theme = Colors[colorScheme];
  const nativeRootStyle: ViewStyle | undefined = Platform.OS === 'web' ? undefined : { backgroundColor: props.checked ? theme.textSecondary : theme.backgroundSelected };
  const rootStyle = typeof style === 'function' ? (state: PressableStateCallbackType) => [nativeRootStyle, style(state)] : [nativeRootStyle, style];
  const thumbColor = colorScheme === 'dark' && props.checked ? theme.background : Colors.light.background;
  return (
    <SwitchPrimitives.Root
      style={rootStyle}
      className={cn(
        'flex h-[1.15rem] w-8 shrink-0 flex-row items-center rounded-full border border-transparent shadow-sm shadow-black/5',
        Platform.select({
          web: 'focus-visible:border-ring focus-visible:ring-ring/50 peer inline-flex outline-none transition-all focus-visible:ring-[3px] disabled:cursor-not-allowed',
        }),
        Platform.OS === 'web' && (props.checked ? 'bg-primary' : 'bg-input dark:bg-input/80'),
        props.disabled && 'opacity-50',
        className
      )}
      {...props}>
      <SwitchPrimitives.Thumb
        style={Platform.select({ native: { backgroundColor: thumbColor, transform: [{ translateX: props.checked ? 14 : 0 }] } })}
        className={cn(
          'size-4 rounded-full',
          Platform.select({
            web: 'pointer-events-none block bg-background ring-0 transition-transform',
          }),
          Platform.OS === 'web' && (props.checked
            ? 'dark:bg-primary-foreground web:translate-x-3.5'
            : 'dark:bg-foreground web:translate-x-0')
        )}
      />
    </SwitchPrimitives.Root>
  );
}

export { Switch };
