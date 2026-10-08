import { hasMappedRoom } from '../features/room-location';

export const NIK_DESTINATION = 'Óbudai Egyetem Neumann János Informatikai Kar, Budapest, Bécsi út 96/B';
export type MapProvider = 'google' | 'apple' | 'waze';
export type TravelMode = 'transit' | 'walking' | 'driving';
/** Campus rooms resolve to the building; online meetings are never treated as street addresses. */
export function directionsDestination(location: string): string | null {
  const text = location.trim();
  if (!text || text.length > 500 || /[\u0000-\u001f]/.test(text)) return null;
  if (hasMappedRoom(text)) return NIK_DESTINATION;
  if (/\b(?:https?:\/\/|www\.)|^[a-z][a-z\d+.-]*:/i.test(text) || /^(?:online|teams|zoom|google meet|meet)(?:\s|$)/i.test(text)) return null;
  return text;
}
/** No origin is supplied: the map app uses its own current-location permission and routing. */
export function directionsUrl(destination: string, provider: MapProvider, mode: TravelMode): string {
  const target = encodeURIComponent(destination);
  if (provider === 'apple') return `https://maps.apple.com/?daddr=${target}&dirflg=${mode === 'transit' ? 'r' : mode === 'walking' ? 'w' : 'd'}`;
  if (provider === 'waze') return `https://waze.com/ul?q=${target}&navigate=yes`;
  return `https://www.google.com/maps/dir/?api=1&destination=${target}&travelmode=${mode}&dir_action=navigate`;
}
export const DIRECTIONS_CATEGORY = 'triton_directions';
export const DIRECTIONS_ACTION = 'triton_open_directions';
