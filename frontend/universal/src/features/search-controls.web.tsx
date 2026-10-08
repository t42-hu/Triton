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
import { SearchControls as MobileSearchControls, type SearchControlsProps } from './search-controls-shared';

/** Keeps profile scope beside the query and offers shortcuts to real rooms. */
export function SearchControls(props: SearchControlsProps) {
  const { width } = useWindowDimensions();
  const rooms = useRoomSuggestions(props.scope);
  if (width < 600) return <MobileSearchControls {...props} />;
  return <View className="gap-5">
    <View className={width >= 1100 ? 'flex-row items-end gap-4' : 'gap-4'}>
      <View className="min-w-0 flex-1 gap-2"><Text nativeID="search-query-label" className="text-sm font-medium">Mit keresel?</Text><View className="min-w-0 flex-row items-center gap-3 rounded-lg border border-input bg-card px-3 focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/15"><Icon as={Search} size={18} className="text-muted-foreground" /><Input accessibilityLabel="Mit keresel?" aria-labelledby="search-query-label" value={props.query} onChangeText={props.setQuery} placeholder="Tantárgy, terem, feladat vagy jegyzet…" className="h-11 min-w-0 flex-1 rounded-none border-0 bg-transparent px-0 text-sm shadow-none focus:border-0 focus:ring-0 dark:bg-transparent" />{props.query ? <Button accessibilityLabel="Keresés törlése" variant="ghost" size="icon" className="border-0 bg-transparent" onPress={() => props.setQuery('')}><Icon as={X} size={16} /></Button> : null}</View></View>
      <View className="gap-2" style={width >= 1100 ? { width: 216 } : undefined}><Text className="text-sm font-medium">Keresés profilja</Text><Choice fullWidth icon={UsersRound} label="Keresés profilja" value={props.scope} onChange={props.setScope} options={props.options} /></View>
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
