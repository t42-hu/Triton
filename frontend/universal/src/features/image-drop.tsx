import { useState } from 'react';
import { View } from 'react-native';
import { requireNativeView, requireOptionalNativeModule } from 'expo';
import type { ComponentType, ReactNode } from 'react';
import type { ProfileImageAsset } from '@/domain/profile-image';
import type { ImageDropProps } from './image-drop.types';

type DropViewProps = { disabled: boolean; children: ReactNode; style: { width: '100%' }; onImage: (event: { nativeEvent: ProfileImageAsset }) => void; onDropError: (event: { nativeEvent: { message: string } }) => void; onDragStateChange: (event: { nativeEvent: { active: boolean } }) => void };
const DropView: ComponentType<DropViewProps> | null = requireOptionalNativeModule('TritonImageDrop') ? requireNativeView('TritonImageDrop') : null;

export function ImageDrop({ disabled, onImage, onError, children }: ImageDropProps) {
  const [active, setActive] = useState(false);
  // Older installed bundles still support the ordinary image picker.
  if (!DropView) return <View style={{ width: '100%' }}>{children(false)}</View>;
  return <DropView disabled={disabled} style={{ width: '100%' }} onImage={event => onImage(event.nativeEvent)} onDropError={event => onError(event.nativeEvent.message)} onDragStateChange={event => setActive(event.nativeEvent.active)}><View style={{ width: '100%' }}>{children(active && !disabled)}</View></DropView>;
}
