import type { ReactNode } from 'react';
import { View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import type { WorkspaceScreen } from './student-workspace';
import { usePanelLock } from './panel-lock';

const destinations: WorkspaceScreen[] = ['today', 'calendar', 'tasks', 'search'];
/** Keeps screen order consistent with the navbar; the timetable retains its own horizontal scroll. */
export function NavigationSwipe({ children, screen, navigate, openMenu, enabled = true, onDrag, onRelease, edgeOnly = false, fill = false }: { children: ReactNode; screen: WorkspaceScreen; navigate: (screen: WorkspaceScreen) => void; openMenu: () => void; enabled?: boolean; onDrag?: (translationX: number) => void; onRelease?: () => void; edgeOnly?: boolean; fill?: boolean }) {
  const isPanelOpen = usePanelLock();
  function move(translationX: number) {
    onRelease?.();
    if (isPanelOpen || Math.abs(translationX) < 60) return;
    const index = destinations.indexOf(screen) + (translationX < 0 ? 1 : -1);
    if (index === destinations.length) { openMenu(); return; }
    const next = destinations[index];
    if (next) navigate(next);
  }
  const swipe = Gesture.Pan().enabled(enabled && !isPanelOpen).onTouchesDown((event, manager) => { if (edgeOnly && (event.allTouches[0]?.absoluteX ?? 25) > 24) manager.fail(); }).activeOffsetX([-24, 24]).failOffsetY([-18, 18]).runOnJS(true).onUpdate(event => onDrag?.(event.translationX)).onEnd(event => move(event.translationX));
  return <GestureDetector gesture={swipe} touchAction="pan-y"><View collapsable={false} style={fill ? { flex: 1 } : undefined}>{children}</View></GestureDetector>;
}
