import { TextClassContext } from '@/components/ui/text';
import { cn } from '@/lib/utils';
import * as TabsPrimitive from '@rn-primitives/tabs';
import { Platform, type LayoutChangeEvent } from 'react-native';
import { createContext, useContext, useState } from 'react';
import Animated, { FadeInRight, FadeOutLeft, ReduceMotion, useAnimatedStyle } from 'react-native-reanimated';
import { NativeOnlyAnimatedView } from '@/components/ui/native-only-animated-view';
import { useMotionValue } from '@/hooks/use-motion-value';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { Colors } from '@/constants/theme';

const SlidingTabsContext = createContext(false);

/** A single selection surface slides between equally sized segments. */
function SlidingTabsList({ values, children, square = false, ...props }: React.ComponentProps<typeof TabsPrimitive.List> & { values: string[]; square?: boolean }) {
  const { value } = TabsPrimitive.useRootContext();
  const [width, setWidth] = useState(0);
  const progress = useMotionValue(Math.max(0, values.indexOf(value)));
  const theme = Colors[useColorScheme()];
  const segmentWidth = Math.max(0, (width - 8 - (values.length - 1) * 4) / values.length);
  const indicatorStyle = useAnimatedStyle(() => ({ transform: [{ translateX: progress.value * (segmentWidth + 4) }] }));
  function measure(event: LayoutChangeEvent) { setWidth(event.nativeEvent.layout.width); props.onLayout?.(event); }
  return <SlidingTabsContext.Provider value><TabsList {...props} onLayout={measure}>
    <Animated.View pointerEvents="none" style={[{ position: 'absolute', top: 4, bottom: 4, left: 4, width: segmentWidth, borderRadius: square ? 0 : 8, backgroundColor: theme.textSecondary }, indicatorStyle]} />
    {children}
  </TabsList></SlidingTabsContext.Provider>;
}

function Tabs({
  className,
  ...props
}: React.ComponentProps<typeof TabsPrimitive.Root>) {
  return <TabsPrimitive.Root className={cn('flex flex-col gap-2', className)} {...props} />;
}

function TabsList({
  className,
  ...props
}: React.ComponentProps<typeof TabsPrimitive.List>) {
  return (
    <TabsPrimitive.List
      className={cn(
        'relative bg-card border border-foreground/50 flex h-[44px] flex-row items-center justify-center gap-1 rounded-xl p-1',
        Platform.select({ web: 'inline-flex w-fit', native: 'mr-auto' }),
        className
      )}
      {...props}
    />
  );
}

function TabsTrigger({
  className,
  ...props
}: React.ComponentProps<typeof TabsPrimitive.Trigger>) {
  const { value } = TabsPrimitive.useRootContext();
  const isSliding = useContext(SlidingTabsContext);
  return (
    <TextClassContext.Provider
      value={cn(
        'text-sm font-semibold',
        value === props.value ? 'text-primary-foreground' : 'text-foreground'
      )}>
      <TabsPrimitive.Trigger
        className={cn(
          'flex h-full min-w-14 flex-row items-center justify-center gap-1.5 rounded-md border border-transparent px-3 py-1 shadow-none shadow-black/5 hover:bg-primary/10 active:bg-primary/15',
          Platform.select({
            web: 'focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:outline-ring inline-flex cursor-pointer whitespace-nowrap motion-safe:transition-colors duration-150 focus-visible:outline-1 focus-visible:ring-[3px] disabled:pointer-events-none [&_svg]:pointer-events-none [&_svg]:shrink-0',
          }),
          props.disabled && 'opacity-50',
          isSliding ? 'bg-transparent' : props.value === value ? 'border-primary bg-primary' : 'bg-transparent active:bg-accent',
          className
        )}
        {...props}
      />
    </TextClassContext.Provider>
  );
}

function TabsContent({
  className,
  ...props
}: React.ComponentProps<typeof TabsPrimitive.Content>) {
  const { value } = TabsPrimitive.useRootContext();
  const selected = value === props.value;
  return (
    <TabsPrimitive.Content
      className={cn(
        Platform.select({
          web: cn(
            'flex-1 outline-none',
            selected && 'animate-in fade-in-0 slide-in-from-right-3 duration-200 ease-out motion-reduce:animate-none'
          ),
        }),
        className
      )}
      {...props}
    >
      <NativeOnlyAnimatedView
        key={`${props.value}:${selected}`}
        entering={selected ? FadeInRight.duration(200).reduceMotion(ReduceMotion.System) : undefined}
        exiting={FadeOutLeft.duration(120).reduceMotion(ReduceMotion.System)}>
        {props.children}
      </NativeOnlyAnimatedView>
    </TabsPrimitive.Content>
  );
}

export { Tabs, TabsContent, TabsList, SlidingTabsList, TabsTrigger };
