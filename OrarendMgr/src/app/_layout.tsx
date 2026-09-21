import '@/global.css';
import { Stack, ThemeProvider } from 'expo-router';
import { PortalHost } from '@rn-primitives/portal';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { useColorScheme as useSystemTheme } from 'react-native';
import { useColorScheme } from 'nativewind';
import { useEffect } from 'react';
import { StatusBar } from 'expo-status-bar';
import { AppProvider, useApp } from '@/features/app-state';
import { NAV_THEME } from '@/lib/theme';

export default function RootLayout() {
  return <GestureHandlerRootView style={{ flex: 1 }}><AppProvider><Navigation /></AppProvider></GestureHandlerRootView>;
}
function Navigation() {
  const { view } = useApp();
  const system = useSystemTheme();
  const { setColorScheme } = useColorScheme();
  const theme = view.theme === 'system' ? (system === 'dark' ? 'dark' : 'light') : view.theme;
  useEffect(() => setColorScheme(view.theme), [view.theme, setColorScheme]);
  return <ThemeProvider value={NAV_THEME[theme]}><StatusBar style={theme === 'dark' ? 'light' : 'dark'} /><Stack screenOptions={{ headerShown: false }} /><PortalHost /></ThemeProvider>;
}
