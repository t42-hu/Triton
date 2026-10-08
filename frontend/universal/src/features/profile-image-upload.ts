import { Platform } from 'react-native';
import { File as CacheFile } from 'expo-file-system';
import * as DocumentPicker from 'expo-document-picker';
import { backend } from '@/data/backend';
import { PROFILE_IMAGE_TYPES, profileImageType, type ProfileImageAsset } from '@/domain/profile-image';

export async function pickProfileImage() {
  const result = await DocumentPicker.getDocumentAsync({ type: PROFILE_IMAGE_TYPES, copyToCacheDirectory: true });
  return result.canceled ? undefined : result.assets[0];
}

/** Both input paths keep the server's image optimization and account update flow. */
export async function uploadProfileImage(asset: ProfileImageAsset) {
  try {
    const type = profileImageType(asset);
    const form = imageForm(asset, type);
    const uploaded = await backend<{ key: string }>('/profile-images/optimize', 'POST', form);
    return uploaded.key;
  } finally {
    cleanupImage(asset);
  }
}

function imageForm(asset: ProfileImageAsset, type: string) {
  const form = new FormData();
  if (Platform.OS === 'web') {
    if (!asset.file) throw new Error('Nem sikerült megnyitni a képet.');
    form.append('file', asset.file, asset.name);
  } else form.append('file', { uri: asset.uri, name: asset.name, type } as unknown as Blob, asset.name);
  return form;
}

function cleanupImage(asset: ProfileImageAsset) {
  if (Platform.OS === 'web' || !asset.temporary) return;
  try { new CacheFile(asset.uri).delete(); } catch { /* The OS can already have purged its cache. */ }
}
