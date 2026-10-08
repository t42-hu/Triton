import { useEffect, useRef, useState, type ReactNode } from 'react';
import { View, type LayoutChangeEvent } from 'react-native';
import Animated, { Easing, ReduceMotion, useAnimatedStyle, useSharedValue, withTiming, useReducedMotion, type SharedValue } from 'react-native-reanimated';
import type { WorkspaceScreen } from './student-workspace';

const screens: WorkspaceScreen[] = ['today', 'calendar', 'tasks', 'search'];
type Props = { screen: WorkspaceScreen; renderPage: (screen: WorkspaceScreen) => ReactNode };

/** Places pages on one horizontal strip; only the active page receives input and accessibility focus. */
export function WorkspacePages({ screen, renderPage }: Props) {
  const [width, setWidth] = useState(0);
  const [heights, setHeights] = useState<Partial<Record<WorkspaceScreen, number>>>({});
  const offset = useSharedValue(0);
  const previousWidth = useRef(0);
  const reducedMotion = useReducedMotion();
  const index = screens.indexOf(screen);
  useEffect(() => {
    if (previousWidth.current !== width) { previousWidth.current = width; offset.set(-index * width); return; }
    offset.set(withTiming(-index * width, { duration: 280, easing: Easing.bezier(0.23, 1, 0.32, 1), reduceMotion: ReduceMotion.System }));
  }, [index, width, offset]);
  const stripStyle = useAnimatedStyle(() => ({ transform: [{ translateX: offset.get() }] }));
  function measureWidth(event: LayoutChangeEvent) { setWidth(event.nativeEvent.layout.width); }
  function measurePage(page: WorkspaceScreen, event: LayoutChangeEvent) {
    const height = event.nativeEvent.layout.height;
    setHeights(previous => previous[page] === height ? previous : { ...previous, [page]: height });
  }
  return <View onLayout={measureWidth} style={{ overflow: 'hidden', height: heights[screen], width: '100%' }}>
    {width > 0 ? <View>
      <Animated.View style={[{ width: width * screens.length, flexDirection: 'row', alignItems: 'flex-start' }, stripStyle]}>
        {screens.map((page, pageIndex) => <PageSurface offset={offset} index={pageIndex} reducedMotion={reducedMotion} key={page} onLayout={event => measurePage(page, event)} pointerEvents={page === screen ? 'auto' : 'none'} accessibilityElementsHidden={page !== screen} importantForAccessibility={page === screen ? 'auto' : 'no-hide-descendants'} aria-hidden={page !== screen} style={{ width, flexShrink: 0 }}>{renderPage(page)}</PageSurface>)}
      </Animated.View>
    </View> : null}
  </View>;
}


function PageSurface({ offset, index, reducedMotion, children, style, ...props }: React.ComponentProps<typeof View> & { offset: SharedValue<number>; index: number; reducedMotion: boolean }) {
  const width = (style as { width: number }).width;
  const motion = useAnimatedStyle(() => {
    const distance = reducedMotion ? 0 : Math.min(1, Math.abs(offset.get() / width + index));
    return { opacity: 1 - distance * 0.25, transform: [{ scale: 1 - distance * 0.025 }] };
  });
  return <Animated.View {...props} style={[style, motion]}>{children}</Animated.View>;
}
