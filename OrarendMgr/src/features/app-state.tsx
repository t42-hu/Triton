import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { ActivityIndicator, View } from 'react-native';
import type { Anchor, Profile } from '../domain/model';
import { monday, today } from '../domain/time';
import { profiles } from '../data/repository';
import { readSetting, saveSetting } from '../data/database';
import { Text } from '@/components/ui/text';

export type ViewState = {
  left: number; right: number; openProfiles: number[]; leftDate: string; rightDate: string; mode: 'day' | 'week';
  compare: boolean; sync: boolean; common: boolean; hidden: boolean; zoom: number;
  leftScroll: number; rightScroll: number; theme: 'system' | 'light' | 'dark';
};
const initialView: ViewState = { left: 0, right: 0, openProfiles: [], leftDate: today(), rightDate: today(), mode: 'week', compare: false, sync: true, common: false, hidden: false, zoom: 1, leftScroll: 420, rightScroll: 420, theme: 'system' };
const initialAnchor: Anchor = { date: monday(today()), week: 'A' };
type AppState = {
  view: ViewState; setView: (patch: Partial<ViewState> | ((current: ViewState) => Partial<ViewState>)) => void; anchor: Anchor;
  profileList: Profile[]; version: number; refresh: () => Promise<void>;
  error: string; setError: (message: string) => void;
};
const Context = createContext<AppState | null>(null);

/** Restores durable UI state only after SQLite has initialized successfully. */
export function AppProvider({ children }: { children: ReactNode }) {
  const [view, updateView] = useState(initialView);
  const [anchor, setAnchor] = useState(initialAnchor);
  const [profileList, setProfiles] = useState<Profile[]>([]);
  const [version, setVersion] = useState(0);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState('');
  async function refresh() {
    const nextProfiles = await profiles(); setProfiles(nextProfiles); updateView(current => resolveProfiles(current, nextProfiles)); setAnchor(await readSetting('anchor', initialAnchor)); setVersion(value => value + 1);
  }
  function reportError(error: unknown) { setError(String(error)); }
  useEffect(() => {
    async function restore() {
      await refresh(); updateView(resolveProfiles({ ...initialView, ...await readSetting('view', initialView) }, await profiles())); setReady(true);
    }
    void restore().catch(reportError);
  }, []);
  useEffect(() => { if (ready) void saveSetting('view', view).catch(reportError); }, [view, ready]);
  if (!ready) return <View className="flex-1 items-center justify-center bg-background p-6"><ActivityIndicator /><Text>{error || 'Órarend megnyitása…'}</Text></View>;
  const setView = (patch: Partial<ViewState> | ((current: ViewState) => Partial<ViewState>)) => updateView(current => ({ ...current, ...(typeof patch === 'function' ? patch(current) : patch) }));
  return <Context.Provider value={{ view, setView, anchor, profileList, version, refresh, error, setError }}>{children}</Context.Provider>;
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
  return { ...view, left, right: openProfiles[0] ?? left, openProfiles, compare: openProfiles.length > 0 };
}
