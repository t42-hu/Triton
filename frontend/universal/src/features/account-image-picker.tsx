import { View } from 'react-native';
import { Image } from 'expo-image';
import { ImagePlus } from 'lucide-react-native';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import type { ProfileImageAsset } from '@/domain/profile-image';
import { ImageDrop } from './image-drop';
import { Action } from './controls';

export function AccountImagePicker({ image, name, busy, choose, receive, reportError, remove }: { image?: string | null; name: string; busy: boolean; choose: () => void; receive: (asset: ProfileImageAsset) => void; reportError: (message: string) => void; remove: () => void }) {
  return <View className="gap-3"><ImageDrop disabled={busy} onImage={receive} onError={reportError}>{active => <View className={`items-center gap-3 rounded-xl border border-dashed p-4 ${active ? 'border-primary bg-primary/10' : 'border-border bg-card'}`}>
    {image ? <Image source={{ uri: image }} style={{ width: 64, height: 64, borderRadius: 32 }} accessibilityLabel="Fiókkép" /> : <View className="h-16 w-16 items-center justify-center rounded-full bg-muted">{name ? <Text className="text-2xl text-primary">{name.slice(0, 1).toUpperCase()}</Text> : <Icon as={ImagePlus} className="text-primary" />}</View>}
    <Text className="font-semibold">{busy ? 'Kép mentése…' : active ? 'Engedd el a képet' : 'Húzd ide a profilképet'}</Text>
    <Text className="text-sm text-muted-foreground">JPEG, PNG vagy WebP · legfeljebb 5 MB</Text>
    <View className="w-full"><Action secondary disabled={busy} onPress={choose}>Kép kiválasztása</Action></View>
  </View>}</ImageDrop>{image ? <Action secondary disabled={busy} onPress={remove}>Fiókkép törlése</Action> : null}</View>;
}
