import { Bell, BellOff } from 'lucide-react-native';
import { Icon } from '@/components/ui/icon';

export function ReminderBell({ enabled, size }: { enabled: boolean; size: number }) {
  return <Icon as={enabled ? Bell : BellOff} size={size} className={enabled ? 'text-primary' : 'text-destructive'} />;
}
