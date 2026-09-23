import { useColorScheme as useNativeWindTheme } from 'nativewind';

/** Shares the app's manual appearance choice with legacy theme consumers. */
export function useColorScheme() { return useNativeWindTheme().colorScheme ?? 'light'; }
