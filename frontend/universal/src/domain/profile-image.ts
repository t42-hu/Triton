export const PROFILE_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
export const PROFILE_IMAGE_LIMIT = 5 * 1024 * 1024;
export type ProfileImageAsset = { uri: string; name: string; mimeType?: string; size?: number; file?: File; temporary?: boolean };

/** Picker and drop inputs share the same validation before starting an upload. */
export function profileImageType(asset: ProfileImageAsset) {
  const extension = asset.name.split('.').pop()?.toLowerCase();
  const inferred = extension === 'jpg' || extension === 'jpeg' ? 'image/jpeg' : extension === 'png' ? 'image/png' : extension === 'webp' ? 'image/webp' : '';
  const type = asset.mimeType || inferred;
  if (!PROFILE_IMAGE_TYPES.includes(type)) throw new Error('JPEG, PNG vagy WebP képet válassz.');
  if (asset.size === 0) throw new Error('A kiválasztott kép üres.');
  if ((asset.size ?? 0) > PROFILE_IMAGE_LIMIT) throw new Error('A kép legfeljebb 5 MB lehet.');
  return type;
}
