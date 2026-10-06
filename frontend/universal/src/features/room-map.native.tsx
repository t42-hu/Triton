import { useEffect, useRef, useState } from 'react';
import { WebView, type WebViewMessageEvent } from 'react-native-webview';
import { FLOORS, PLACES, type FloorId } from './nik-map-data';
import { roomMapHtml, type MapMode, type MapTheme } from './room-map-html';

type Props = { mode: MapMode; floor: FloorId; theme: MapTheme; placeId?: string; height: number; onFloorChange: (floor: FloorId) => Promise<void> };

function messageFloor(data: string): FloorId | null {
  try {
    const message: unknown = JSON.parse(data);
    if (!message || typeof message !== 'object') return null;
    const value = message as Record<string, unknown>;
    if (value.type !== 'triton-floor-change') return null;
    return FLOORS.find(item => item.id === value.floor)?.id ?? null;
  } catch { return null; }
}

/** Loads the authored map HTML directly in the native WebView on iOS and Android. */
export default function RoomMap({ mode, floor, theme, placeId, height, onFloorChange }: Props) {
  const webView = useRef<WebView>(null);
  const appliedFloor = useRef(floor);
  const appliedPlaceId = useRef(placeId);
  const [source] = useState(() => ({ html: roomMapHtml(mode, floor, placeId, theme) }));
  const [isLoaded, setIsLoaded] = useState(false);
  const selectedPlaceFloor = PLACES.find(place => place.id === placeId)?.floor;
  useEffect(() => {
    if (!isLoaded || (appliedFloor.current === floor && appliedPlaceId.current === placeId)) return;
    const otherFloor = floor === 'F' ? 'A' : 'F';
    const clearSelection = appliedPlaceId.current && appliedPlaceId.current !== placeId ? `window.tritonMap.setFloor(${JSON.stringify(otherFloor)});` : '';
    const selection = selectedPlaceFloor === floor ? `window.tritonMap.selectPlace(${JSON.stringify(placeId)});` : '';
    webView.current?.injectJavaScript(`if (window.tritonMap) { ${clearSelection} window.tritonMap.setFloor(${JSON.stringify(floor)}); ${selection} } true;`);
    appliedFloor.current = floor;
    appliedPlaceId.current = placeId;
  }, [floor, isLoaded, placeId, selectedPlaceFloor]);
  function receiveMessage(event: WebViewMessageEvent) {
    const selectedFloor = messageFloor(event.nativeEvent.data);
    if (!selectedFloor) return;
    appliedFloor.current = selectedFloor;
    void onFloorChange(selectedFloor);
  }
  return <WebView ref={webView} source={source} originWhitelist={['*']} onMessage={receiveMessage} onLoadEnd={() => setIsLoaded(true)} scrollEnabled={false} style={{ height, backgroundColor: 'transparent' }} />;
}
