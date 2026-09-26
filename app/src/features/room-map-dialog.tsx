import { useState } from 'react';
import { View, useColorScheme, useWindowDimensions } from 'react-native';
import { Box, Map, MapPinned } from 'lucide-react-native';
import { Icon } from '@/components/ui/icon';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Text } from '@/components/ui/text';
import { useApp } from './app-state';
import { Modal } from './controls';
import { FLOORS, type FloorId } from './nik-map-data';
import RoomMap from './room-map.dom';
import type { MapMode } from './room-map-html';
import { findRoomLocation, type RoomLocation } from './room-location';

export function RoomField({ value, onChange, onOpen }: { value: string; onChange: (value: string) => void; onOpen: () => void }) {
  return <View className="flex-row items-end gap-2"><View className="min-w-0 flex-1 gap-1.5"><Label nativeID="Terem">Terem</Label><Input accessibilityLabel="Terem" aria-labelledby="Terem" value={value} onChangeText={onChange} autoCapitalize="none" /></View>
    <Button accessibilityLabel="Terem megjelenítése a térképen" variant="outline" className="h-10 w-10 rounded-md p-0" onPress={onOpen}><Icon as={MapPinned} size={18} className="text-primary" /></Button>
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
    {FLOORS.map(item => <Button key={item.id} accessibilityLabel={item.name} accessibilityState={{ selected: floor === item.id }} variant={floor === item.id ? 'default' : 'outline'} className="h-8 min-w-10 px-2" onPress={() => setFloor(item.id)}><Text className="text-xs">{item.id}</Text></Button>)}
  </View></View>;
}

export function RoomMapDialog({ location, close }: { location: string; close: () => void }) {
  const room = findRoomLocation(location);
  const { view: appView } = useApp();
  const systemTheme = useColorScheme();
  const theme = appView.theme === 'system' ? (systemTheme === 'dark' ? 'dark' : 'light') : appView.theme;
  const { width } = useWindowDimensions();
  const [view, setView] = useState<MapMode>('2d');
  const [selectedFloor, setSelectedFloor] = useState<FloorId>(room?.floor ?? 'F');
  const mapHeight = width < 600 ? (view === '2d' ? 260 : 360) : 420;
  const floorName = FLOORS.find(item => item.id === selectedFloor)?.name ?? 'Földszint';
  if (location.trim() && !room) return <Modal title="Terem térképe" description={location} close={close}><Text className="text-sm text-muted-foreground">Ehhez a teremhez nincs adat a Bécsi úti NIK térképen.</Text></Modal>;
  return <Modal title="Terem térképe" description={room ? `${location} · ${room.floorName}` : '2D és 3D épülettérkép'} close={close} wide>
    <View className="gap-3"><View className="flex-row items-center gap-3"><View className="h-10 w-10 items-center justify-center rounded-xl bg-primary/10"><Icon as={MapPinned} size={20} className="text-primary" /></View><View><Text className="text-lg font-semibold">{floorName}</Text><Text className="text-xs text-muted-foreground">NIK épülettérkép{room ? ` · ${room.roomCode}` : ''}</Text></View></View>
      <View className="flex-row items-center justify-between gap-2"><Text className="text-sm font-medium">Térkép</Text><MapViewPicker view={view} setView={setView} /></View>
      <FloorPicker floor={selectedFloor} setFloor={setSelectedFloor} />
      <View className="overflow-hidden rounded-xl border border-border" style={{ height: mapHeight }}><RoomMap key={`${view}-${selectedFloor}`} mode={view} floor={selectedFloor} theme={theme} placeId={selectedFloor === room?.floor ? room.place?.id : undefined} height={mapHeight} onFloorChange={async floor => setSelectedFloor(floor)} dom={{ style: { width: '100%', height: mapHeight }, scrollEnabled: false }} /></View>
      {room && selectedFloor === room.floor ? <RoomMapStatus room={room} /> : <Text className="text-sm text-muted-foreground">{room ? `Aktuális szint: ${floorName} · Keresett terem: ${room.floorName}` : floorName}</Text>}
      <Text className="text-xs text-muted-foreground">Szemléltető, nem méretarányos térkép.</Text>
    </View>
  </Modal>;
}
