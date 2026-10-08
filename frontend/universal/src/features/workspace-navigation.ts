import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef } from 'react';
import { BackHandler } from 'react-native';
import { usePanelLock } from './panel-lock';
import type { WorkspaceScreen } from './student-workspace';

/** Updates the current route without replacing the shared shell or its hover state. */
export function useWorkspaceNavigation() {
  const { workspace } = useLocalSearchParams<{ workspace?: string }>();
  const screen: WorkspaceScreen = workspace === 'calendar' || workspace === 'tasks' || workspace === 'search' ? workspace : 'today';
  const history = useRef<WorkspaceScreen[]>([]);
  const isPanelOpen = usePanelLock();
  useEffect(() => {
    router.setParams({ workspace: 'today' });
  }, []);
  function navigate(next: WorkspaceScreen) {
    if (isPanelOpen || next === screen) return;
    history.current.push(screen);
    router.setParams({ workspace: next });
  }
  function goBack() {
    if (isPanelOpen) return true;
    const previous = history.current.pop();
    if (!previous) return false;
    router.setParams({ workspace: previous });
    return true;
  }
  useEffect(() => {
    const subscription = BackHandler.addEventListener('hardwareBackPress', goBack);
    return () => subscription.remove();
  });
  return { screen, navigate };
}
