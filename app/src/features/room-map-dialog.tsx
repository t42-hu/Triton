import { useEffect, useState } from 'react';
import { Linking, Platform, Pressable, View, useColorScheme, useWindowDimensions } from 'react-native';
import { Box, Map, MapPinned, Layers, MapPin, ExternalLink } from 'lucide-react-native';
import { Icon } from '@/components/ui/icon';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Text } from '@/components/ui/text';
import { useApp } from './app-state';
import { Modal } from './controls';
import { FLOORS, PLACES, type FloorId } from './nik-map-data';
import { knownRooms } from '../data/repository';
import RoomMap from './room-map';
import type { MapMode } from './room-map-html';
import { findRoomLocation, hasMappedRoom, locationLink, type RoomLocation } from './room-location';

const mapRooms = PLACES.flatMap(place => place.code && !place.range ? [place.code] : []);

function RoomSuggestion({ room, choose }: { room: string; choose: (room: string) => void }) {
  return <Pressable accessibilityRole="button" accessibilityLabel={`${room} terem kiválasztása`} className="flex-row items-center gap-2 rounded-lg border-b border-border px-3 py-2 hover:bg-primary/5 active:bg-primary/10 last:border-b-0" onPressIn={() => choose(room)} onPress={() => choose(room)}><Icon as={MapPin} size={15} className="text-primary" /><Text>{room}</Text></Pressable>;
}

export function RoomField({ value, onChange, onOpen, allowMap = true }: { value: string; onChange: (value: string) => void; onOpen: () => void; allowMap?: boolean }) {
  const [rooms, setRooms] = useState<string[]>(mapRooms);
  const [editing, setEditing] = useState(false);
  useEffect(() => {
    async function loadRooms() { try { setRooms([...new Set([...await knownRooms(), ...mapRooms])]); } catch { setRooms(mapRooms); } }
    void loadRooms();
  }, []);
  const [linkError, setLinkError] = useState('');
  const link = locationLink(value, allowMap);
  const isMapped = allowMap && hasMappedRoom(value);
  async function openLink() {
    if (!link) return;
    setLinkError('');
    try { await Linking.openURL(link); } catch { setLinkError('A helyszín linkjét nem sikerült megnyitni.'); }
  }
  const query = value.trim().toLocaleLowerCase('hu');
  const matches = editing && allowMap && !link && query.length > 0 ? rooms.filter(room => room.toLocaleLowerCase('hu').includes(query) && room.toLocaleLowerCase('hu') !== query).slice(0, 5) : [];
  function choose(room: string) { onChange(room); setEditing(false); }
  return <View className="relative gap-1.5" style={{ zIndex: editing ? 10 : 0 }}>
    {matches.length ? <View className="absolute left-0 overflow-hidden rounded-lg border border-border bg-card" style={{ bottom: 44, right: 48, maxHeight: 200 }}>{matches.map(room => <RoomSuggestion key={room} room={room} choose={choose} />)}</View> : null}
    <View className="flex-row items-end gap-2"><View className="min-w-0 flex-1 gap-1.5"><Label nativeID="Terem">{allowMap ? 'Terem / helyszín' : 'Helyszín (opcionális)'}</Label><Input accessibilityLabel="Terem" aria-labelledby="Terem" value={value} onFocus={() => setEditing(true)} onBlur={() => setEditing(false)} onChangeText={onChange} placeholder="Terem vagy https://…" autoCapitalize="none" /></View>
    {isMapped ? <Button accessibilityLabel="Terem megjelenítése a térképen" variant="outline" className="h-10 w-10 rounded-md p-0" onPress={onOpen}><Icon as={MapPinned} size={18} className="text-primary" /></Button> : link ? <Button accessibilityLabel="Helyszínlink megnyitása" variant="outline" className="h-10 w-10 rounded-md p-0" onPress={() => void openLink()}><Icon as={ExternalLink} size={18} className="text-primary" /></Button> : null}</View>
    {linkError ? <Text accessibilityRole="alert" className="text-sm text-destructive">{linkError}</Text> : null}
  </View>;
}

function RoomMapStatus({ room }: { room: RoomLocation }) {
  if (!room.place) return <Text className="text-sm text-muted-foreground">Az emelet ismert, de a terem pontos helye nincs jelölve ezen az alaprajzon.</Text>;
  if (room.place.range) return <Text className="text-sm text-muted-foreground">A kiemelt rész a {room.place.code} teremszám-tartomány területe. Az egyedi ajtó helye nem ismert.</Text>;
  return <View className="flex-row items-center gap-2"><View className="h-2.5 w-2.5 rounded-full bg-destructive" /><Text className="text-sm font-medium">{room.place.name} · {room.roomCode}</Text></View>;
}

function MapViewPicker({ view, setView }: { view: MapMode; setView: (view: MapMode) => void }) {
  return <View className="flex-row gap-1 rounded-lg border border-border bg-muted/40 p-1">
    <Button accessibilityLabel="2D alaprajz" accessibilityState={{ selected: view === '2d' }} variant={view === '2d' ? 'default' : 'ghost'} className="h-8 gap-1.5 px-3" onPress={() => setView('2d')}><Icon as={Map} size={15} /><Text className="text-xs">2D</Text></Button>
    <Button accessibilityLabel="Forgatható 3D térkép" accessibilityState={{ selected: view === '3d' }} variant={view === '3d' ? 'default' : 'ghost'} className="h-8 gap-1.5 px-3" onPress={() => setView('3d')}><Icon as={Box} size={15} /><Text className="text-xs">3D</Text></Button>
  </View>;
}

function FloorPicker({ floor, setFloor }: { floor: FloorId; setFloor: (floor: FloorId) => void }) {
  return <View className="gap-1.5"><Text className="text-xs font-medium text-muted-foreground">Szint kiválasztása</Text><View className="flex-row flex-wrap gap-1.5">
    {FLOORS.map(item => <Button key={item.id} accessibilityLabel={item.name} accessibilityState={{ selected: floor === item.id }} variant={floor === item.id ? 'default' : 'outline'} className="h-8 min-w-10 px-2" onPress={() => setFloor(item.id)}><Icon as={Layers} size={13} /><Text className="text-xs">{item.id}</Text></Button>)}
  </View></View>;
}

export function RoomMapDialog({ location, close, open = true }: { location: string; close: () => void; open?: boolean }) {
  const room = findRoomLocation(location);
  const { view: appView } = useApp();
  const systemTheme = useColorScheme();
  const theme = appView.theme === 'system' ? (systemTheme === 'dark' ? 'dark' : 'light') : appView.theme;
  const { width } = useWindowDimensions();
  const [view, setView] = useState<MapMode>('2d');
  const [floorSelection, setFloorSelection] = useState({ location, floor: room?.floor ?? 'F' });
  const selectedFloor = floorSelection.location === location ? floorSelection.floor : room?.floor ?? 'F';
  function setSelectedFloor(floor: FloorId) { setFloorSelection({ location, floor }); }
  const mapHeight = width < 600 ? (view === '2d' ? 260 : 360) : 420;
  const floorName = FLOORS.find(item => item.id === selectedFloor)?.name ?? 'Földszint';
  return <Modal title="Terem térképe" description={room ? `${location} · ${room.floorName}` : '2D és 3D épülettérkép'} close={close} open={open} keepMounted={Platform.OS === 'ios'} wide>
    <View className="gap-3"><View className="flex-row items-center gap-3"><View className="h-10 w-10 items-center justify-center rounded-xl bg-primary/10"><Icon as={MapPinned} size={20} className="text-primary" /></View><View><Text className="text-lg font-semibold">{floorName}</Text><Text className="text-xs text-muted-foreground">NIK épülettérkép{room ? ` · ${room.roomCode}` : ''}</Text></View></View>
      {location.trim() && !room ? <Text className="text-sm text-muted-foreground">Ehhez a teremhez nincs adat a Bécsi úti NIK térképen.</Text> : null}
      <View className="flex-row items-center justify-between gap-2"><Text className="text-sm font-medium">Térkép</Text><MapViewPicker view={view} setView={setView} /></View>
      <FloorPicker floor={selectedFloor} setFloor={setSelectedFloor} />
      <View className="overflow-hidden rounded-xl border border-border" style={{ height: mapHeight }}>{Platform.OS === 'ios' ? (['2d', '3d'] as const).map(mode => <View key={`${mode}-${theme}`} pointerEvents={view === mode ? 'auto' : 'none'} importantForAccessibility={view === mode ? 'auto' : 'no-hide-descendants'} style={{ position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, opacity: view === mode ? 1 : 0 }}><RoomMap mode={mode} floor={selectedFloor} theme={theme} placeId={room?.place?.id} height={mapHeight} onFloorChange={async floor => setSelectedFloor(floor)} /></View>) : <RoomMap key={`${view}-${theme}`} mode={view} floor={selectedFloor} theme={theme} placeId={room?.place?.id} height={mapHeight} onFloorChange={async floor => setSelectedFloor(floor)} />}</View>
      {room && selectedFloor === room.floor ? <RoomMapStatus room={room} /> : <Text className="text-sm text-muted-foreground">{room ? `Aktuális szint: ${floorName} · Keresett terem: ${room.floorName}` : floorName}</Text>}
      <Text className="text-xs text-muted-foreground">Szemléltető, nem méretarányos térkép.</Text>
    </View>
  </Modal>;
}
