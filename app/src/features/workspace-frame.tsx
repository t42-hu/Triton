import type { ReactNode } from 'react';
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
  return <SafeAreaView className="flex-1 bg-background">{header}{navigation}{children}{footer}</SafeAreaView>;
}
