import type { ReactNode } from 'react';
import type { ProfileImageAsset } from '@/domain/profile-image';

export type ImageDropProps = { disabled: boolean; onImage: (asset: ProfileImageAsset) => void; onError: (message: string) => void; children: (active: boolean) => ReactNode };
