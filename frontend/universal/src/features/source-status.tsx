import { useEffect, useState } from 'react';
import { Platform, View } from 'react-native';
import { Clock3 } from 'lucide-react-native';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { syncStatus, disconnectCalendar, SYNC_INTERVAL, type SyncStatus } from '../data/calendar-sync';
import { readSetting } from '../data/database';
import { enableNotifications } from '../data/calendar-runtime';
import { useApp } from './app-state';
import { Action, Toggle } from './controls';
import type { useCalendarSync } from './use-calendar-sync';
import { firstImportedWeek } from '../data/repository';

/** Loads the earliest imported calendar week for one profile. */
export function useFirstImportedWeek(profileId: number): string | null {
  const { version, setError } = useApp();
  const [result, setResult] = useState<{ profileId: number; firstWeek: string | null }>({ profileId, firstWeek: null });
  useEffect(() => {
    let active = true;
    async function load() {
      try { const value = await firstImportedWeek(profileId); if (active) setResult({ profileId, firstWeek: value }); }
      catch (reason) { setError(String(reason)); }
    }
    void load();
    return () => { active = false; };
  }, [profileId, version, setError]);
  return result.profileId === profileId ? result.firstWeek : null;
}

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
  if (!status?.url) return null;
  return <View className="flex-row items-center gap-1.5 border-b border-border px-5 pb-3"><Icon as={Clock3} size={13} className="text-muted-foreground" /><Text className="shrink text-xs text-muted-foreground">Frissítve: {new Date(status.lastSuccess).toLocaleTimeString('hu-HU', { timeZone: 'Europe/Budapest', hour: '2-digit', minute: '2-digit' })}</Text></View>;
}
export function CalendarSyncPanel({ syncState, onDisconnected }: { syncState: ReturnType<typeof useCalendarSync>; onDisconnected?: () => void }) {
  const app = useApp();
  const owner = app.profileList.find(profile => profile.isOwn);
  const status = useSourceStatus(owner?.id ?? 0);
  const { busy, sync } = syncState;
  const [notifications, setNotifications] = useState(false);
  const [message, setMessage] = useState('');
  function reportSettingsError() { setMessage('Nem sikerült betölteni az értesítési beállítást.'); }
  useEffect(() => { void readSetting('changeNotifications', false).then(setNotifications).catch(reportSettingsError); }, []);
  async function toggle(enabled: boolean) {
    try { await enableNotifications(enabled); setNotifications(enabled); setMessage(''); }
    catch (error) { setMessage(error instanceof Error ? error.message : 'Nem sikerült az értesítési beállítás.'); }
  }
  async function disconnect() {
    try { if (status) await disconnectCalendar(status.sourceId); await app.refresh(); onDisconnected?.(); }
    catch { setMessage('Nem sikerült leválasztani a linket.'); }
  }
  if (!status?.url || Platform.OS === 'web') return null;
  const next = status.lastAttempt + SYNC_INTERVAL;
  return <View className="gap-6 border-t border-border pt-4">
    <Text className="font-semibold">Saját órarend · {owner?.name}</Text>
    <View className="gap-4"><SyncTimestamp label="Frissítve" time={status.lastSuccess} /><SyncTimestamp label="Következő szinkronizáció" time={next} /></View>
    {status.lastChange ? <Text accessibilityLiveRegion="polite">{status.lastChange}</Text> : null}
    {status.lastError || message ? <Text accessibilityRole="alert" className="text-destructive">{status.lastError || message}</Text> : null}
    <View className="gap-3"><Action secondary disabled={busy} onPress={() => void sync()}>{busy ? 'Frissítés…' : 'Frissítés ellenőrzése'}</Action><Action quiet onPress={() => void disconnect()}>Link leválasztása</Action></View>
    <Toggle label="Értesítés órarendváltozáskor" checked={notifications} onChange={value => void toggle(value)} />
  </View>;
}

/** Separates scheduling labels from their readable timestamp values. */
function SyncTimestamp({ label, time }: { label: string; time: number }) {
  return <View className="gap-1"><Text className="text-xs text-muted-foreground">{label}</Text><Text className="text-sm font-medium">{timestamp(time)}</Text></View>;
}
