import { NotificationDirections } from '@/features/notification-directions';
import '@/global.css';
import { LegacyDataScreen } from '@/features/legacy-data-screen';
import { AuthProvider, useAuth } from '@/features/auth-state';
import { AuthScreen, SessionLoading } from '@/features/auth-screen';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { BatteryOptimizationPrompt } from '@/features/battery-optimization-prompt';
import { usePanelLock } from '@/features/panel-lock';
import '@/data/calendar-runtime';
import { Stack, ThemeProvider } from 'expo-router';
import { PortalHost } from '@rn-primitives/portal';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { Platform, useColorScheme as useSystemTheme } from 'react-native';
import { useColorScheme } from 'nativewind';
import { useEffect } from 'react';
import { StatusBar } from 'expo-status-bar';
import { AppProvider, useApp } from '@/features/app-state';
import { NAV_THEME } from '@/lib/theme';

export default function RootLayout() {
  return <GestureHandlerRootView style={{ flex: 1 }}><SafeAreaProvider><AuthProvider><SessionRoot /></AuthProvider></SafeAreaProvider></GestureHandlerRootView>;
}
function SessionRoot() {
  const auth = useAuth();
  if (auth.checking) return <SessionLoading />;
  if (!auth.user) return <AuthScreen />;
  if (auth.legacyCount) return <LegacyDataScreen />;
  return <AppProvider key={auth.user.id}><Navigation /></AppProvider>;
}
function Navigation() {
  const { view } = useApp();
  const isPanelOpen = usePanelLock();
  const system = useSystemTheme();
  const { setColorScheme } = useColorScheme();
  const theme = view.theme === 'system' ? (system === 'dark' ? 'dark' : 'light') : view.theme;
  // NativeWind's web class strategy removes .dark for "system", even on a dark OS.
  useEffect(() => setColorScheme(Platform.OS === 'web' ? theme : view.theme), [theme, view.theme, setColorScheme]);
  return <ThemeProvider value={NAV_THEME[theme]}><StatusBar style={theme === 'dark' ? 'light' : 'dark'} /><Stack screenOptions={{ headerShown: false, title: 'Triton42', gestureEnabled: !isPanelOpen, animation: 'slide_from_right' }} /><PortalHost /><BatteryOptimizationPrompt /><NotificationDirections /></ThemeProvider>;
}
