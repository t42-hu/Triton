import { useRef } from 'react';
import { ScrollView, View, useWindowDimensions } from 'react-native';
import { useColorScheme } from 'nativewind';
import { MapPinned } from 'lucide-react-native';
import { Icon } from '@/components/ui/icon';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Text } from '@/components/ui/text';
import { Modal } from './controls';
import { NikFloorMap } from './nik-floor-map';
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

export function RoomMapDialog({ location, close }: { location: string; close: () => void }) {
  const room = findRoomLocation(location);
  const { width } = useWindowDimensions();
  const { colorScheme } = useColorScheme();
  const scroll = useRef<ScrollView>(null);
  const mapWidth = width < 600 ? 800 : 900;
  function centerSelected(viewportWidth: number) {
    const center = (room?.place?.x ?? 600) * mapWidth / 1200;
    requestAnimationFrame(() => scroll.current?.scrollTo({ x: Math.max(0, center - viewportWidth / 2), animated: false }));
  }
  if (!room) return <Modal title="Terem térképe" description={location || 'Nincs megadva terem.'} close={close}><Text className="text-sm text-muted-foreground">Ehhez a teremhez nincs adat a Bécsi úti NIK térképen.</Text></Modal>;
  return <Modal title="Terem térképe" description={`${location} · ${room.floorName}`} close={close} wide>
    <View className="gap-3"><View className="flex-row items-center gap-3"><View className="h-10 w-10 items-center justify-center rounded-xl bg-primary/10"><Icon as={MapPinned} size={20} className="text-primary" /></View><View><Text className="text-lg font-semibold">{room.floorName}</Text><Text className="text-xs text-muted-foreground">NIK épülettérkép · {room.roomCode}</Text></View></View>
      <View className="overflow-hidden rounded-xl border border-border bg-background/30"><ScrollView ref={scroll} horizontal onLayout={event => centerSelected(event.nativeEvent.layout.width)}><NikFloorMap floor={room.floor} selectedId={room.place?.id} dark={colorScheme === 'dark'} width={mapWidth} /></ScrollView></View>
      <RoomMapStatus room={room} /><Text className="text-xs text-muted-foreground">Szemléltető, nem méretarányos alaprajz.{width < 600 ? ' Húzd oldalra a térképet a teljes emelethez.' : ''}</Text>
    </View>
  </Modal>;
}
