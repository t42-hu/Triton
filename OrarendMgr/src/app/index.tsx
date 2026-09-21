import { TriangleAlert } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { ScrollView, View, useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Text } from '@/components/ui/text';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import { useApp } from '@/features/app-state';
import { Action, Toggle } from '@/features/controls';
import { CalendarPanel } from '@/features/calendar-panel';
import { ProfilesDialog } from '@/features/profiles-dialog';
import { ImportDialog } from '@/features/import-dialog';
import { ManualDialog } from '@/features/manual-dialog';
import { SettingsDialog } from '@/features/settings-dialog';
import { EventDialog } from '@/features/event-dialog';
import { visibleEvents } from '@/data/repository';
import type { DisplayEvent } from '@/domain/model';
import { commonKeys } from '@/domain/comparison';
import { monday, today } from '@/domain/time';

type DialogName = 'profiles' | 'import' | 'manual' | 'settings' | null;
export default function TimetableScreen() {
  const app = useApp(); const { width } = useWindowDimensions();
  const [dialog, setDialog] = useState<DialogName>(null);
  const [event, setEvent] = useState<DisplayEvent>();
  const data = useCalendarData();
  return <SafeAreaView className="flex-1 bg-background"><ScrollView contentContainerStyle={{ padding: width < 600 ? 12 : 28, gap: 20, flexGrow: 1 }}>
    <View className="flex-row flex-wrap items-center justify-between gap-4"><View className="gap-1"><Text className="text-3xl font-bold tracking-tight">Órarend</Text><Text className="text-sm text-muted-foreground">A heted, egy helyen.</Text></View>
      <View className="flex-row flex-wrap gap-2"><Action secondary onPress={() => setDialog('profiles')}>Profilok</Action><Action secondary onPress={() => setDialog('settings')}>Beállítások</Action></View></View>
    {app.error ? <Alert icon={TriangleAlert} variant="destructive"><AlertTitle>Nem sikerült a művelet</AlertTitle><AlertDescription>{app.error}</AlertDescription></Alert> : null}
    {!app.profileList.length ? <EmptyState create={() => setDialog('profiles')} /> : <>
      <Toolbar open={setDialog} />
      <View className="gap-4" style={{ flexDirection: width >= 1000 ? 'row' : 'column' }}>
        <CalendarPanel side="left" date={data.leftDate} profileId={data.leftId} events={data.left} common={data.leftCommon} selectEvent={setEvent} />
        {app.view.compare ? <CalendarPanel side="right" date={data.rightDate} profileId={data.rightId} events={data.right} common={data.rightCommon} selectEvent={setEvent} /> : null}
      </View><Text className="text-xs text-muted-foreground">Europe/Budapest · Az adatok ezen az eszközön maradnak.</Text>
    </>}
    {dialog === 'profiles' ? <ProfilesDialog close={() => setDialog(null)} /> : null}
    {dialog === 'import' ? <ImportDialog profileId={data.leftId} close={() => setDialog(null)} /> : null}
    {dialog === 'manual' ? <ManualDialog profileId={data.leftId} close={() => setDialog(null)} /> : null}
    {dialog === 'settings' ? <SettingsDialog close={() => setDialog(null)} /> : null}
    {event ? <EventDialog event={event} close={() => setEvent(undefined)} /> : null}
  </ScrollView></SafeAreaView>;
}
function useCalendarData() {
  const { view, profileList, version, setError } = useApp();
  const [left, setLeft] = useState<DisplayEvent[]>([]); const [right, setRight] = useState<DisplayEvent[]>([]);
  const leftId = profileList.find(profile => profile.id === view.left)?.id ?? profileList[0]?.id ?? 0;
  const rightId = profileList.find(profile => profile.id === view.right)?.id ?? profileList[1]?.id ?? leftId;
  const leftDate = view.mode === 'week' ? monday(view.leftDate) : view.leftDate;
  const rightDate = view.mode === 'week' ? monday(view.rightDate) : view.rightDate;
  const days = view.mode === 'week' ? 7 : 1;
  useEffect(() => {
    let canceled = false;
    async function load() {
      const [first, second] = await Promise.all([visibleEvents(leftId, leftDate, days, view.hidden), visibleEvents(rightId, rightDate, days, view.hidden)]);
      if (canceled) return;
      setLeft(first); setRight(second);
    }
    function failed(error: unknown) { if (!canceled) setError(String(error)); }
    void load().catch(failed);
    return () => { canceled = true; };
  }, [leftId, rightId, leftDate, rightDate, days, version, view.hidden, setError]);
  return { left, right, leftId, rightId, leftDate, rightDate, leftCommon: view.compare ? commonKeys(left, right) : new Set<string>(), rightCommon: view.compare ? commonKeys(right, left) : new Set<string>() };
}
function Toolbar({ open }: { open: (dialog: DialogName) => void }) {
  const { view, setView } = useApp();
  return <View className="gap-3"><View className="flex-row flex-wrap items-center justify-between gap-3">
    <View className="flex-row flex-wrap items-center gap-2"><Tabs value={view.mode} onValueChange={mode => setView({ mode: mode === 'day' ? 'day' : 'week' })}><TabsList><TabsTrigger value="day"><Text>Nap</Text></TabsTrigger><TabsTrigger value="week"><Text>Hét</Text></TabsTrigger></TabsList></Tabs>
      <Action secondary onPress={() => setView({ leftDate: today(), rightDate: today() })}>Ma</Action><Action secondary label="Kicsinyítés" onPress={() => setView({ zoom: Math.max(0.5, view.zoom - 0.25) })}>−</Action><Badge variant="outline"><Text>{Math.round(view.zoom * 100)}%</Text></Badge><Action secondary label="Nagyítás" onPress={() => setView({ zoom: Math.min(2.5, view.zoom + 0.25) })}>+</Action></View>
    <View className="flex-row gap-2"><Action secondary onPress={() => open('import')}>Importálás</Action><Action onPress={() => open('manual')}>+ Új óra</Action></View>
  </View><View className="flex-row flex-wrap gap-5"><Toggle label="Összehasonlítás" checked={view.compare} onChange={compare => setView({ compare })} />
    {view.compare ? <><Toggle label="Szinkronlapozás" checked={view.sync} onChange={sync => setView({ sync, ...(sync ? { rightDate: view.leftDate } : {}) })} /><Toggle label="Csak közös órák" checked={view.common} onChange={common => setView({ common })} /></> : null}
  </View></View>;
}
function EmptyState({ create }: { create: () => void }) {
  return <View className="min-h-96 items-center justify-center gap-5 rounded-xl border border-border bg-card p-8">
    <Text className="text-center text-2xl font-semibold">Melyik órarenddel kezdjük?</Text><Text className="max-w-md text-center text-muted-foreground">Hozz létre egy profilt, majd importáld az óráidat ICS- vagy JSON-fájlból. Saját órákat is felvehetsz.</Text><Action onPress={create}>Első profil létrehozása</Action>
  </View>;
}
