import { View } from 'react-native';
import { Image } from 'expo-image';
import { ImagePlus, Trash2 } from 'lucide-react-native';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import type { ProfileImageAsset } from '@/domain/profile-image';
import { ImageDrop } from './image-drop';
import { Action } from './controls';
import { Button } from '@/components/ui/button';

export function AccountImagePicker({ image, name, busy, choose, receive, reportError, remove }: { image?: string | null; name: string; busy: boolean; choose: () => void; receive: (asset: ProfileImageAsset) => void; reportError: (message: string) => void; remove: () => void }) {
  return <ImageDrop disabled={busy} onImage={receive} onError={reportError}>{active => <View className={`flex-row items-center gap-4 rounded-xl border p-4 ${active ? 'border-dashed border-primary bg-primary/10' : 'border-transparent bg-primary/5'}`}>
    {image ? <Image source={{ uri: image }} style={{ width: 64, height: 64, borderRadius: 32 }} accessibilityLabel="Fiókkép" /> : <View className="h-16 w-16 items-center justify-center rounded-full bg-muted">{name ? <Text className="text-2xl text-primary">{name.slice(0, 1).toUpperCase()}</Text> : <Icon as={ImagePlus} className="text-primary" />}</View>}
    <View className="min-w-0 flex-1 gap-2"><Text className="font-semibold">{busy ? 'Kép mentése…' : active ? 'Engedd el a képet' : 'Profilkép'}</Text>
      <View className="flex-row flex-wrap items-center gap-2"><Action secondary icon={ImagePlus} disabled={busy} onPress={choose}>{image ? 'Kép cseréje' : 'Kép kiválasztása'}</Action>{image ? <Button variant="ghost" size="icon" disabled={busy} accessibilityLabel="Fiókkép törlése" onPress={remove}><Icon as={Trash2} size={17} className="text-muted-foreground" /></Button> : null}</View>
    </View>
  </View>}</ImageDrop>;
}
