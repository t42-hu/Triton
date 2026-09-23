import { useEffect, useState } from 'react';
import { Platform, View } from 'react-native';
import { Text } from '@/components/ui/text';
import { syncStatus, disconnectCalendar, SYNC_INTERVAL, type SyncStatus } from '../data/calendar-sync';
import { readSetting } from '../data/database';
import { enableNotifications } from '../data/calendar-runtime';
import { useApp } from './app-state';
import { Action, Toggle } from './controls';
import { useCalendarSync } from './use-calendar-sync';

export function useSourceStatus(profileId: number): SyncStatus | null {
  const { version, setError } = useApp();
  const [status, setStatus] = useState<SyncStatus | null>(null);
  useEffect(() => {
    let canceled = false;
    async function load() { try { const value = await syncStatus(`${profileId}:import`); if (!canceled) setStatus(value); } catch { setError('Nem sikerült betölteni a forrás állapotát.'); } }
    void load(); return () => { canceled = true; };
  }, [profileId, version, setError]);
  return status;
}
function timestamp(time: number): string {
  return new Date(time).toLocaleString('hu-HU', { timeZone: 'Europe/Budapest' });
}
export function SourceStamp({ profileId }: { profileId: number }) {
  const status = useSourceStatus(profileId);
  if (!status) return null;
  return <Text className="px-4 py-2 text-xs text-muted-foreground">{status.url ? 'Frissítve' : 'Importálva'}: {timestamp(status.lastSuccess)}{!status.url || !status.autoSync ? ' · Statikus másolat' : ''}</Text>;
}
export function CalendarSyncPanel() {
  const app = useApp();
  const owner = app.profileList.find(profile => profile.isOwn);
  const status = useSourceStatus(owner?.id ?? 0);
  const { busy, background, sync } = useCalendarSync();
  const [notifications, setNotifications] = useState(false);
  const [message, setMessage] = useState('');
  function reportSettingsError() { setMessage('Nem sikerült betölteni az értesítési beállítást.'); }
  useEffect(() => { void readSetting('changeNotifications', false).then(setNotifications).catch(reportSettingsError); }, []);
  async function toggle(enabled: boolean) {
    try { await enableNotifications(enabled); setNotifications(enabled); setMessage(''); }
    catch (error) { setMessage(error instanceof Error ? error.message : 'Nem sikerült az értesítési beállítás.'); }
  }
  async function disconnect() {
    try { if (status) await disconnectCalendar(status.sourceId); await app.refresh(); }
    catch { setMessage('Nem sikerült leválasztani a linket.'); }
  }
  if (!status?.url || Platform.OS === 'web') return null;
  const next = status.lastAttempt + SYNC_INTERVAL;
  return <View className="gap-2 rounded-xl border border-border bg-card p-4">
    <Text className="font-semibold">Saját órarend · {owner?.name}</Text>
    <Text className="text-sm text-muted-foreground">Frissítve: {timestamp(status.lastSuccess)}. Új lekérés legkorábban: {timestamp(next)}.</Text>
    <Text className="text-xs text-muted-foreground">{background}</Text>
    {status.lastChange ? <Text accessibilityLiveRegion="polite">{status.lastChange}</Text> : null}
    {status.lastError || message ? <Text accessibilityRole="alert" className="text-destructive">{status.lastError || message}</Text> : null}
    <View className="flex-row flex-wrap gap-2"><Action secondary disabled={busy} onPress={() => void sync()}>{busy ? 'Frissítés…' : 'Frissítés ellenőrzése'}</Action><Action quiet onPress={() => void disconnect()}>Link leválasztása</Action></View>
    <Toggle label="Értesítés órarendváltozáskor" checked={notifications} onChange={value => void toggle(value)} />
  </View>;
}
