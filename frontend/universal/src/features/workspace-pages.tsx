import { useEffect, useState, type ReactNode } from 'react';
import { View, type LayoutChangeEvent } from 'react-native';
import Animated, { Easing, ReduceMotion, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import type { WorkspaceScreen } from './student-workspace';

const screens: WorkspaceScreen[] = ['today', 'calendar', 'tasks', 'search'];
type Props = { screen: WorkspaceScreen; renderPage: (screen: WorkspaceScreen) => ReactNode };

/** Places pages on one horizontal strip; only the active page receives input and accessibility focus. */
export function WorkspacePages({ screen, renderPage }: Props) {
  const [width, setWidth] = useState(0);
  const [heights, setHeights] = useState<Partial<Record<WorkspaceScreen, number>>>({});
  const offset = useSharedValue(0);
  const index = screens.indexOf(screen);
  useEffect(() => {
    offset.set(withTiming(-index * width, { duration: 220, easing: Easing.out(Easing.cubic), reduceMotion: ReduceMotion.System }));
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
        {screens.map(page => <View key={page} onLayout={event => measurePage(page, event)} pointerEvents={page === screen ? 'auto' : 'none'} accessibilityElementsHidden={page !== screen} importantForAccessibility={page === screen ? 'auto' : 'no-hide-descendants'} aria-hidden={page !== screen} style={{ width, flexShrink: 0 }}>{renderPage(page)}</View>)}
      </Animated.View>
    </View> : null}
  </View>;
}
