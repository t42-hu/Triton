import { FLOORS, PLACES, type FloorId, type Place } from './nik-map-data';

export type RoomLocation = { floor: FloorId; floorName: string; roomCode: string; place?: Place };

export function findRoomLocation(location: string): RoomLocation | null {
  const normalized = location.trim().toUpperCase().replace(/\s+/g, '');
  const match = normalized.match(/^(?:BA\.)?([AF0-4])\.(\d{1,3})(?:\.|$)/);
  if (!match || (/^B[A-Z]\./.test(normalized) && !normalized.startsWith('BA.'))) return null;
  const floor = (match[1] === '0' ? 'F' : match[1]) as FloorId;
  const floorName = FLOORS.find(item => item.id === floor)?.name;
  if (!floorName) return null;
  const roomCode = `${floor}.${match[2].padStart(2, '0')}`;
  const exact = PLACES.find(place => place.floor === floor && place.code?.toUpperCase() === roomCode);
  const number = Number(match[2]);
  const place = exact ?? PLACES.find(item => item.floor === floor && item.range?.[0] === floor && number >= item.range[1] && number <= item.range[2]);
  return { floor, floorName, roomCode, place };
}
