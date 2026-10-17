import * as CollapsiblePrimitive from '@rn-primitives/collapsible';
import { cn } from '@/lib/utils';
import { NativeOnlyAnimatedView } from '@/components/ui/native-only-animated-view';
import { Platform } from 'react-native';
import Animated, { FadeInDown, FadeOutUp, LinearTransition, ReduceMotion } from 'react-native-reanimated';

function Collapsible({ className, children, ...props }: React.ComponentProps<typeof CollapsiblePrimitive.Root>) {
  return (
    <CollapsiblePrimitive.Root {...props} className={className} asChild={Platform.OS !== 'web'}>
      <Animated.View
        layout={LinearTransition.duration(180).reduceMotion(ReduceMotion.System)}>
        {children}
      </Animated.View>
    </CollapsiblePrimitive.Root>
  );
}

const CollapsibleTrigger = CollapsiblePrimitive.Trigger;

function CollapsibleContent({ className, children, ...props }: React.ComponentProps<typeof CollapsiblePrimitive.Content>) {
  return (
    <CollapsiblePrimitive.Content
      {...props}
      className={cn(
        'overflow-hidden',
        Platform.select({ web: 'animate-in fade-in-0 slide-in-from-top-2 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:slide-out-to-top-2 duration-180 ease-out motion-reduce:animate-none' }),
        className
      )}
      asChild={Platform.OS !== 'web'}>
      <NativeOnlyAnimatedView
        entering={FadeInDown.duration(180).reduceMotion(ReduceMotion.System)}
        exiting={FadeOutUp.duration(140).reduceMotion(ReduceMotion.System)}>
        {children}
      </NativeOnlyAnimatedView>
    </CollapsiblePrimitive.Content>
  );
}

export { Collapsible, CollapsibleTrigger, CollapsibleContent };
