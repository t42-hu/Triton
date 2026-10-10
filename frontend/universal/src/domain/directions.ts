import { hasMappedRoom } from '../features/room-location';

export const NIK_DESTINATION = 'Óbudai Egyetem Neumann János Informatikai Kar, Budapest, Bécsi út 96/B';
export type MapProvider = 'google' | 'apple' | 'waze';
export type TravelMode = 'transit' | 'walking' | 'driving';
export function mapLocationUrl(location: string): string | null {
  try {
    const url = new URL(location.trim());
    if (url.protocol !== 'https:' || url.username || url.password) return null;
    const host = url.hostname.toLowerCase();
    const supported = ['maps.apple', 'maps.apple.com', 'maps.google.com', 'maps.app.goo.gl', 'goo.gl', 'waze.com', 'www.waze.com'].includes(host)
      || (['google.com', 'www.google.com'].includes(host) && url.pathname.startsWith('/maps'));
    return supported ? url.href : null;
  } catch { return null; }
}
/** Campus rooms resolve to the building; online meetings are never treated as street addresses. */
export function directionsDestination(location: string): string | null {
  const text = location.trim();
  if (!text || text.length > 500 || /[\u0000-\u001f]/.test(text)) return null;
  if (hasMappedRoom(text)) return NIK_DESTINATION;
  const mapLink = mapLocationUrl(text);
  if (mapLink) return mapLink;
  if (/\b(?:https?:\/\/|www\.)|^[a-z][a-z\d+.-]*:/i.test(text) || /^(?:online|teams|zoom|google meet|meet)(?:\s|$)/i.test(text)) return null;
  return text;
}
/** No origin is supplied: the map app uses its own current-location permission and routing. */
export function directionsUrl(destination: string, provider: MapProvider, mode: TravelMode): string {
  const mapLink = mapLocationUrl(destination);
  if (mapLink) return mapLink;
  const target = encodeURIComponent(destination);
  if (provider === 'apple') return `https://maps.apple.com/?daddr=${target}&dirflg=${mode === 'transit' ? 'r' : mode === 'walking' ? 'w' : 'd'}`;
  if (provider === 'waze') return `https://waze.com/ul?q=${target}&navigate=yes`;
  return `https://www.google.com/maps/dir/?api=1&destination=${target}&travelmode=${mode}&dir_action=navigate`;
}
export const DIRECTIONS_CATEGORY = 'triton_directions';
export const DIRECTIONS_ACTION = 'triton_open_directions';
