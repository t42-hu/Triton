import { useState, type ReactNode } from 'react';
import { View, type LayoutChangeEvent } from 'react-native';
import Animated, { useAnimatedStyle } from 'react-native-reanimated';
import { useMotionValue } from '@/hooks/use-motion-value';

/** Reveals measured content without springs, preserving drafts and respecting reduced motion. */
export function AnimatedDisclosure({ expanded, children, gap = 0 }: { expanded: boolean; children: ReactNode; gap?: number }) {
  const progress = useMotionValue(Number(expanded));
  const [contentHeight, setContentHeight] = useState(0);
  const height = useMotionValue(expanded ? contentHeight : 0);
  const style = useAnimatedStyle(() => ({ height: height.value, opacity: progress.value, marginTop: -gap * (1 - progress.value) }));
  function measureContent(event: LayoutChangeEvent) { setContentHeight(event.nativeEvent.layout.height); }
  return <Animated.View style={[{ overflow: 'hidden' }, style]} pointerEvents={expanded ? 'auto' : 'none'} aria-hidden={!expanded} accessibilityElementsHidden={!expanded} importantForAccessibility={expanded ? 'auto' : 'no-hide-descendants'}>
    <View onLayout={measureContent} style={{ position: 'absolute', top: 0, left: 0, right: 0 }}>{children}</View>
  </Animated.View>;
}
