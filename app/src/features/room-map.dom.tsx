'use dom';

import { useEffect, useRef } from 'react';
import { roomMapHtml, type MapMode, type MapTheme } from './room-map-html';
import { FLOORS, type FloorId } from './nik-map-data';

type Props = { mode: MapMode; floor: FloorId; theme: MapTheme; placeId?: string; height: number; onFloorChange: (floor: FloorId) => Promise<void>; dom?: import('expo/dom').DOMProps };

function isFloorMessage(value: unknown): value is { type: 'triton-floor-change'; floor: FloorId } {
  if (!value || typeof value !== 'object') return false;
  const message = value as Record<string, unknown>;
  return message.type === 'triton-floor-change' && FLOORS.some(item => item.id === message.floor);
}

/** Renders the app's 2D or 3D map inside the room map dialog. */
export default function RoomMap({ mode, floor, theme, placeId, height, onFloorChange }: Props) {
  const frame = useRef<HTMLIFrameElement>(null);
  useEffect(() => {
    function receiveFloor(event: MessageEvent<unknown>) {
      if (event.source !== frame.current?.contentWindow || !isFloorMessage(event.data)) return;
      void onFloorChange(event.data.floor);
    }
    window.addEventListener('message', receiveFloor);
    return () => window.removeEventListener('message', receiveFloor);
  }, [onFloorChange]);
  return <iframe ref={frame} title={mode === '2d' ? 'NIK alaprajz' : 'Forgatható NIK épületmodell'} srcDoc={roomMapHtml(mode, floor, placeId, theme)} style={{ display: 'block', width: '100%', height, border: 0 }} />;
}
