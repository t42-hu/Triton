import { useWorkspaceSync } from './use-workspace-sync';
import { DEFAULT_EVENT_COLORS, type EventColors } from '../domain/event-colors';
import { useCurrentTime } from '@/hooks/use-current-time';
import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { Image } from 'expo-image';
import type { Anchor, Profile } from '../domain/model';
import { monday, today } from '../domain/time';
import { profiles } from '../data/repository';
import { globalReminders } from '../data/reminders';
import { reminderPermissionGranted } from '../data/reminder-runtime';
import { onDatabasePreview, readSetting, saveSetting } from '../data/database';
import { useOptimisticRemoval } from './use-optimistic-removal';
import { Text } from '@/components/ui/text';
import { Button } from '@/components/ui/button';

export type ViewState = {
  left: number; right: number; openProfiles: number[]; leftDate: string; rightDate: string; mode: 'day' | 'week';
  compare: boolean; arrangement: 'row' | 'column'; sync: boolean; common: boolean; hidden: boolean; showWeekends: boolean; startHour: number; endHour: number; zoom: number;
  leftScroll: number; rightScroll: number; theme: 'system' | 'light' | 'dark';
};
const initialView: ViewState = { left: 0, right: 0, openProfiles: [], leftDate: today(), rightDate: today(), mode: 'week', compare: false, arrangement: 'column', sync: true, common: false, hidden: false, showWeekends: true, startHour: 0, endHour: 24, zoom: 1, leftScroll: 480, rightScroll: 480, theme: 'system' };
const initialAnchor: Anchor = { date: monday(today()), week: 'A' };
type AppState = {
  cloud: ReturnType<typeof useWorkspaceSync>;
  view: ViewState; setView: (patch: Partial<ViewState> | ((current: ViewState) => Partial<ViewState>)) => void; anchor: Anchor;
  calendarImport: { profileId: number; revision: number; hasEvents: boolean } | null; presentCalendarImport: (profileId: number, hasEvents?: boolean) => void;
  profileList: Profile[]; version: number; refresh: () => Promise<void>;
  remindersEnabled: boolean; eventColors: EventColors; now: number; saveEventColors: (colors: EventColors) => Promise<void>;
  savedColors: string[]; savePaletteColor: (color: string) => Promise<void>; removePaletteColor: (color: string) => Promise<void>;
  error: string; setError: (message: string) => void;
};
const Context = createContext<AppState | null>(null);

/** Opens the workspace only after the server has returned the account data. */
export function AppProvider({ children }: { children: ReactNode }) {
  const now = useCurrentTime();
  const { savedColors, setSavedColors, savePaletteColor, removePaletteColor } = useSavedPalette();
  const [eventColors, setEventColors] = useState(DEFAULT_EVENT_COLORS);
  const [view, updateView] = useState(initialView);
  const [anchor, setAnchor] = useState(initialAnchor);
  const [profileList, setProfiles] = useState<Profile[]>([]);
  const [remindersEnabled, setRemindersEnabled] = useState(false);
  const [version, setVersion] = useState(0);
  const [calendarImport, setCalendarImport] = useState<AppState['calendarImport']>(null);
  function presentCalendarImport(profileId: number, hasEvents = true) { setCalendarImport(previous => ({ profileId, hasEvents, revision: (previous?.revision ?? 0) + 1 })); }
  const [ready, setReady] = useState(false);
  const [error, setError] = useState(''); const [attempt, setAttempt] = useState(0);
  const refresh = useCallback(async () => {
    const [nextProfiles, reminders, permissionGranted, nextAnchor, colors, palette] = await Promise.all([profiles(), globalReminders(), reminderPermissionGranted(), readSetting('anchor', initialAnchor), readSetting('eventColors', DEFAULT_EVENT_COLORS), readSetting<string[]>('savedColors', [])]);
    function nextView(current: ViewState) { return resolveProfiles(current, nextProfiles); }
    setSavedColors(palette); setEventColors(colors); setProfiles(nextProfiles); setRemindersEnabled(reminders.enabled && permissionGranted); updateView(nextView); setAnchor(nextAnchor); setVersion(incrementVersion);
  }, [setSavedColors]);
  async function refreshFromCloud() { await refresh(); const saved = await readSetting<Partial<ViewState>>('view', {}); const list = await profiles(); updateView(current => resolveProfiles({ ...current, ...saved }, list)); }
  useDeletionPreview(refresh, setError);
  const cloud = useWorkspaceSync(refreshFromCloud);
  const synchronize = cloud.sync;
  async function saveEventColors(colors: EventColors) { await saveSetting('eventColors', colors); setEventColors(colors); }
  function reportError(error: unknown) { setError(String(error)); }
  useEffect(() => {
    async function restore() {
      setSavedColors(await readSetting<string[]>('savedColors', []));
      await synchronize();
      await refresh(); updateView(resolveProfiles({ ...initialView, ...await readSetting('view', initialView), leftDate: today(), rightDate: today() }, await profiles())); setReady(true);
    }
    void restore().catch(reportError);
  }, [synchronize, attempt, refresh, setSavedColors]);
  useServerView(view, ready, setError);
  if (!ready) return <View className="flex-1 items-center justify-center gap-3 bg-background p-6"><Image source={require('@/assets/images/triton-v15.png')} contentFit="contain" style={{ width: 88, height: 88 }} />{!error ? <ActivityIndicator /> : null}<Text className="text-center">{error ? error : 'Órarend megnyitása…'}</Text>{error ? <Button onPress={() => { setError(''); setAttempt(value => value + 1); }}><Text>Újrapróbálás</Text></Button> : null}</View>;
  const setView = (patch: Partial<ViewState> | ((current: ViewState) => Partial<ViewState>)) => updateView(current => ({ ...current, ...(typeof patch === 'function' ? patch(current) : patch) }));
  return <Context.Provider value={{ cloud, savedColors, savePaletteColor, removePaletteColor, calendarImport, presentCalendarImport, view, setView, anchor, profileList, remindersEnabled, eventColors, now, saveEventColors, version, refresh, error, setError }}>{children}</Context.Provider>;
}
function incrementVersion(value: number) { return value + 1; }
function useSavedPalette() {
  const [savedColors, setSavedColors] = useState<string[]>([]);
  const removal = useOptimisticRemoval<string>();
  async function savePaletteColor(color: string) {
    const next = [...new Set([...await readSetting<string[]>('savedColors', []), color.toLowerCase()])];
    await saveSetting('savedColors', next); setSavedColors(next); removal.restore(color.toLowerCase());
  }
  async function removePaletteColor(color: string) { await removal.remove(color.toLowerCase(), async () => { setSavedColors(await deleteSavedColor(color)); }); }
  return { savedColors: savedColors.filter(color => !removal.removed.has(color.toLowerCase())), setSavedColors, savePaletteColor, removePaletteColor };
}
function useDeletionPreview(refresh: () => Promise<void>, setError: (message: string) => void) {
  useEffect(() => {
    function report(reason: unknown) { setError(String(reason)); }
    function changed() { void refresh().catch(report); }
    return onDatabasePreview(changed);
  }, [refresh, setError]);
}
async function deleteSavedColor(color: string): Promise<string[]> {
  const next = (await readSetting<string[]>('savedColors', [])).filter(saved => saved.toLowerCase() !== color.toLowerCase());
  await saveSetting('savedColors', next);
  return next;
}
export function useApp(): AppState {
  const value = useContext(Context);
  if (!value) throw new Error('Hiányzó AppProvider.');
  return value;
}

function resolveProfiles(view: ViewState, list: Profile[]): ViewState {
  const left = list.find(profile => profile.isOwn)?.id ?? list.find(profile => profile.id === view.left)?.id ?? list[0]?.id ?? 0;
  const previouslyOpen = Array.isArray(view.openProfiles) ? view.openProfiles : [];
  const requested = previouslyOpen.length ? previouslyOpen : view.compare ? [view.right] : [];
  const validIds = new Set(list.map(profile => profile.id));
  const openProfiles = [...new Set(requested)].filter(id => id !== left && validIds.has(id));
  return { ...view, startHour: 0, endHour: 24, left, right: openProfiles[0] ?? left, openProfiles, compare: openProfiles.length > 0 };
}

function useServerView(view: ViewState, ready: boolean, setError: (error: string) => void) {
  useEffect(() => {
    if (!ready) return;
    function report(error: unknown) { setError(String(error)); }
    function save() { void saveSetting('view', view).catch(report); }
    const timer = setTimeout(save, 250);
    return () => clearTimeout(timer);
  }, [view, ready, setError]);
}
