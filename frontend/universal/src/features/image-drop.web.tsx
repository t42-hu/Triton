import { useState, type DragEvent } from 'react';
import type { ImageDropProps } from './image-drop.types';

/** Browser file drops stay inside the picker instead of navigating to the image. */
export function ImageDrop({ disabled, onImage, onError, children }: ImageDropProps) {
  const [active, setActive] = useState(false);
  function drag(event: DragEvent<HTMLDivElement>) {
    if (!event.dataTransfer.types.includes('Files')) return;
    event.preventDefault(); event.stopPropagation();
    event.dataTransfer.dropEffect = disabled ? 'none' : 'copy';
    setActive(!disabled);
  }
  function leave(event: DragEvent<HTMLDivElement>) {
    if (event.relatedTarget instanceof Node && event.currentTarget.contains(event.relatedTarget)) return;
    setActive(false);
  }
  function drop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault(); event.stopPropagation(); setActive(false);
    if (disabled) return;
    const files = Array.from(event.dataTransfer.files);
    if (files.length !== 1) { onError('Egyszerre egy képet húzz ide.'); return; }
    const file = files[0];
    onImage({ uri: '', name: file.name, mimeType: file.type, size: file.size, file });
  }
  return <div role="group" aria-label="Profilkép feltöltése" aria-disabled={disabled} onDragEnter={drag} onDragOver={drag} onDragLeave={leave} onDrop={drop}>{children(active)}</div>;
}
