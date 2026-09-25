import { View } from 'react-native';
import { Bell } from 'lucide-react-native';
import { Icon } from '@/components/ui/icon';

export function ReminderBell({ enabled, size }: { enabled: boolean; size: number }) {
  return <View className="items-center justify-center" style={{ width: size + 4, height: size + 4 }}>
    <Icon as={Bell} size={size} className="text-primary" />
    {enabled ? null : <View pointerEvents="none" className="absolute rounded-full bg-red-500" style={{ width: size + 7, height: 2.5, transform: [{ rotate: '-45deg' }] }} />}
  </View>;
}
