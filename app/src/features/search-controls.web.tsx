import { useEffect, useState } from 'react';
import { View, useWindowDimensions } from 'react-native';
import { Search, UsersRound, X, MapPin } from 'lucide-react-native';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { Choice } from './controls';
import { useApp } from './app-state';
import { lessonRooms } from '@/data/student-repository';
import type { SearchControlsProps } from './search-controls';

/** Keeps profile scope beside the query and offers shortcuts to real rooms. */
export function SearchControls(props: SearchControlsProps) {
  const { width } = useWindowDimensions();
  const rooms = useRoomSuggestions(props.scope);
  return <View className="gap-5">
    <View className={width >= 1100 ? 'flex-row items-center gap-3' : 'gap-3'}>
      <View className="min-w-0 flex-1 flex-row items-center gap-3 rounded-xl border border-input bg-card px-4 focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/15"><Icon as={Search} size={21} className="text-primary" /><Input accessibilityLabel="Mit keresel?" value={props.query} onChangeText={props.setQuery} placeholder="Tantárgy, terem, feladat vagy jegyzet…" className="h-14 min-w-0 flex-1 rounded-none border-0 bg-transparent px-0 text-base shadow-none focus:border-0 focus:ring-0 dark:bg-transparent" />{props.query ? <Button accessibilityLabel="Keresés törlése" variant="ghost" size="icon" className="border-0 bg-transparent" onPress={() => props.setQuery('')}><Icon as={X} size={16} /></Button> : null}</View>
      <View style={width >= 1100 ? { width: 200 } : undefined}><Choice fullWidth icon={UsersRound} label="Keresés profilja" value={props.scope} onChange={props.setScope} options={props.options} /></View>
    </View>
    {!props.query.trim() && rooms.length ? <View className="gap-3"><Text className="text-xs text-muted-foreground">Terem keresése</Text><View className="flex-row flex-wrap gap-2">{rooms.map(room => <Button key={room} variant="link" accessibilityLabel={`${room} keresése`} onPress={() => props.setQuery(room)} className="h-9 gap-2 rounded-lg border border-border/60 bg-muted/20 px-3"><Icon as={MapPin} size={13} className="text-primary" /><Text className="text-xs">{room}</Text></Button>)}</View></View> : null}
  </View>;
}

function useRoomSuggestions(scope: string) {
  const { version } = useApp();
  const [suggestions, setSuggestions] = useState<{ scope: string; rooms: string[] }>({ scope: '', rooms: [] });
  useEffect(() => {
    let cancelled = false;
    if (scope === 'all') return;
    async function load() {
      try { const locations = await lessonRooms(Number(scope)); if (!cancelled) setSuggestions({ scope, rooms: locations.filter(Boolean).slice(0, 3) }); }
      catch { if (!cancelled) setSuggestions({ scope, rooms: [] }); }
    }
    void load();
    return () => { cancelled = true; };
  }, [scope, version]);
  return suggestions.scope === scope ? suggestions.rooms : [];
}
