import { useEffect, useRef, useState } from 'react';
import { AppState, Linking, Platform } from 'react-native';
import * as Battery from 'expo-battery';
import * as IntentLauncher from 'expo-intent-launcher';
import { Text } from '@/components/ui/text';
import { readSetting, saveSetting } from '../data/database';
import { useApp } from './app-state';
import { Action, Modal } from './controls';

/** Offers Android settings once, after a successful user calendar import. */
export function BatteryOptimizationPrompt() {
  const { calendarImport } = useApp();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState('');
  const checking = useRef(false);
  useEffect(() => {
    if (Platform.OS !== 'android' || !calendarImport?.hasEvents || checking.current) return;
    checking.current = true;
    async function check() {
      try {
        if (await readSetting('batteryOptimizationPromptSeen', false)) return;
        const enabled = await Battery.isBatteryOptimizationEnabledAsync();
        await saveSetting('batteryOptimizationPromptSeen', true);
        setOpen(enabled);
      } catch { /* Retry after the next successful import if the check failed. */ }
      finally { checking.current = false; }
    }
    void check();
  }, [calendarImport]);
  useEffect(() => {
    if (!open) return;
    async function checkOnResume(state: string) {
      if (state !== 'active') return;
      try { if (!await Battery.isBatteryOptimizationEnabledAsync()) setOpen(false); } catch { /* Keep the prompt available. */ }
    }
    const subscription = AppState.addEventListener('change', checkOnResume);
    return () => subscription.remove();
  }, [open]);
  if (!open) return null;
  return <Modal title="Megbízható háttérfrissítés" close={() => setOpen(false)}>
    <Text>Az órarend importálása sikerült. A háttérben történő frissítésekhez kapcsold ki a Triton42 akkumulátor-optimalizálását.</Text>
    <Text className="text-sm text-muted-foreground">A megnyíló listában válaszd az összes alkalmazást, keresd meg a Triton42-t, majd engedélyezd a korlátozás nélküli használatot. A megnevezés telefononként eltérhet.</Text>
    <Action onPress={() => void openBatterySettings(setError)}>Akkumulátor-beállítások megnyitása</Action>
    <Action secondary onPress={() => setOpen(false)}>Később</Action>
    {error ? <Text accessibilityRole="alert" className="text-destructive">{error}</Text> : null}
  </Modal>;
}

async function openBatterySettings(setError: (message: string) => void) {
  setError('');
  try { await IntentLauncher.startActivityAsync(IntentLauncher.ActivityAction.IGNORE_BATTERY_OPTIMIZATION_SETTINGS); }
  catch {
    try { await Linking.openSettings(); }
    catch { setError('A beállításokat nem sikerült megnyitni. A telefon beállításaiban keresd meg a Triton42 akkumulátorhasználatát.'); }
  }
}
