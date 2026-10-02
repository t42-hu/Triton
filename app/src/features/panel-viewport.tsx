import { createContext, useContext, useState, type ReactNode } from 'react';
import { useWindowDimensions, type LayoutChangeEvent } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useKeyboardInset } from '@/hooks/use-keyboard-inset';

type PanelViewport = { top: number; bottom: number; height: number; measureHeader: (event: LayoutChangeEvent) => void; measureNavigation: (event: LayoutChangeEvent) => void };
const PanelViewportContext = createContext<PanelViewport | null>(null);

/** Measures app chrome so panels stay inside the usable screen, including with a keyboard. */
export function PanelViewportProvider({ children }: { children: ReactNode }) {
  const { height, width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const keyboardInset = useKeyboardInset();
  const [headerHeight, setHeaderHeight] = useState(69);
  const [navigationHeight, setNavigationHeight] = useState(64);
  const top = insets.top + headerHeight + (width >= 600 ? navigationHeight : 0) + 8;
  const bottom = Math.max(keyboardInset, insets.bottom + (width < 600 ? navigationHeight : 0)) + 8;
  function measureHeader(event: LayoutChangeEvent) { setHeaderHeight(event.nativeEvent.layout.height); }
  function measureNavigation(event: LayoutChangeEvent) { setNavigationHeight(event.nativeEvent.layout.height); }
  return <PanelViewportContext.Provider value={{ top, bottom, height: Math.max(0, height - top - bottom), measureHeader, measureNavigation }}>{children}</PanelViewportContext.Provider>;
}

/** Read before rendering a portal, whose host is outside the screen's context. */
export function usePanelViewport() {
  const viewport = useContext(PanelViewportContext);
  const { height } = useWindowDimensions();
  function ignoreMeasurement() {}
  return viewport ?? { top: 8, bottom: 8, height: height - 16, measureHeader: ignoreMeasurement, measureNavigation: ignoreMeasurement };
}
