import { useState } from 'react';
import { Linking, Platform, View } from 'react-native';
import { Navigation, MapPinned } from 'lucide-react-native';
import { Text } from '@/components/ui/text';
import { Action, Choice, Modal } from './controls';
import { directionsDestination, directionsUrl, mapLocationUrl, type MapProvider, type TravelMode } from '../domain/directions';

export function DirectionsDialog({ location, close }: { location: string; close: () => void }) {
  const destination = directionsDestination(location);
  const mapLink = mapLocationUrl(destination ?? '');
  const [mode, setMode] = useState<TravelMode>('transit');
  const [error, setError] = useState('');
  async function open(provider: MapProvider) {
    if (!destination) return;
    try { await Linking.openURL(directionsUrl(destination, provider, mode)); setError(''); }
    catch { setError('Nem sikerült megnyitni a térképet. Válassz másik térképappot.'); }
  }
  return <Modal title="Útvonaltervezés" close={close} description={mapLink ? undefined : location}>
    {mapLink ? <Action secondary icon={Navigation} onPress={() => void open('google')}>Útvonal megnyitása</Action> : destination ? <><View className="gap-1 border-l-2 border-border py-2 pl-4"><Text className="text-sm text-muted-foreground">Úticél</Text><Text className="font-semibold">{destination}</Text></View>
      <Text className="text-sm text-muted-foreground">Indulás az aktuális helyzetedből. A helymeghatározást a választott térképapp kezeli. Ha az app nincs telepítve, a webes térkép nyílik meg.</Text>
      <View className="gap-2"><Text className="text-sm font-medium">Közlekedési mód</Text><Choice fullWidth label="Közlekedési mód" value={mode} onChange={value => setMode(value as TravelMode)} options={[{ value: 'transit', label: 'Tömegközlekedés' }, { value: 'walking', label: 'Gyalog' }, { value: 'driving', label: 'Autó' }]} /></View>
      <Action secondary icon={MapPinned} onPress={() => void open('google')}>Google Maps</Action>
      {Platform.OS !== 'android' ? <Action secondary icon={MapPinned} onPress={() => void open('apple')}>Apple Térképek</Action> : null}
      {mode === 'driving' ? <Action secondary icon={Navigation} onPress={() => void open('waze')}>Waze</Action> : null}
    </> : <Text>Ehhez a helyszínhez nem tervezhető útvonal.</Text>}
    {error ? <Text accessibilityRole="alert" className="text-destructive">{error}</Text> : null}
  </Modal>;
}
