import { usePanelLock } from './panel-lock';
import type { ReactNode } from 'react';
import { Platform, View, useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { WorkspaceScreen } from './student-workspace';

export type WorkspaceFrameProps = {
  children: ReactNode;
  header: ReactNode;
  navigation: ReactNode;
  footer: ReactNode;
  screen: WorkspaceScreen;
  navigate: (screen: WorkspaceScreen) => void;
  create: () => void;
  openProfiles: () => void;
  openAccount: () => void;
  openLinks: () => void;
  openSettings: () => void;
  openMap: () => void;
  showMap: boolean;
};

/** Preserves the native navigation chrome around the shared workspace. */
export function WorkspaceFrame({ children, header, navigation, footer }: WorkspaceFrameProps) {
  const isPanelOpen = usePanelLock();
  const { width } = useWindowDimensions();
  const locked = { pointerEvents: isPanelOpen ? 'none' as const : 'auto' as const, accessibilityElementsHidden: isPanelOpen, importantForAccessibility: isPanelOpen ? 'no-hide-descendants' as const : 'auto' as const };
  if (Platform.OS !== 'web' && width >= 960) {
    return <SafeAreaView className="flex-1 bg-background"><View {...locked} className="flex-1">{header}<View className="min-h-0 flex-1 flex-row">{navigation}<View className="min-w-0 flex-1">{children}</View></View>{footer}</View></SafeAreaView>;
  }
  return <SafeAreaView edges={footer ? ['top', 'left', 'right'] : undefined} className="flex-1 bg-background"><View {...locked} style={{ flex: 1 }}>{header}{navigation}{children}{footer}</View></SafeAreaView>;
}
