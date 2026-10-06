import { usePanelLock } from './panel-lock';
import type { ReactNode } from 'react';
import { View } from 'react-native';
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
  openSettings: () => void;
  openMap: () => void;
  showMap: boolean;
};

/** Preserves the native navigation chrome around the shared workspace. */
export function WorkspaceFrame({ children, header, navigation, footer }: WorkspaceFrameProps) {
  const isPanelOpen = usePanelLock();
  return <SafeAreaView className="flex-1 bg-background"><View pointerEvents={isPanelOpen ? 'none' : 'auto'} accessibilityElementsHidden={isPanelOpen} importantForAccessibility={isPanelOpen ? 'no-hide-descendants' : 'auto'} style={{ flex: 1 }}>{header}{navigation}{children}{footer}</View></SafeAreaView>;
}
