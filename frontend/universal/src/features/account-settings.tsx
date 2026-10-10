import { View } from 'react-native';
import { Cloud, LogOut, RefreshCw } from 'lucide-react-native';
import { Text } from '@/components/ui/text';
import { Icon } from '@/components/ui/icon';
import { Action } from './controls';
import { useApp } from './app-state';
import { useAuth } from './auth-state';
import { useAccountSignOut } from './use-account-sign-out';
export function AccountSettings({ disabled = false, showSignOut = true, showEmail = true }: { disabled?: boolean; showSignOut?: boolean; showEmail?: boolean }) {
  const auth = useAuth(); const { cloud } = useApp();
  const { signOut, leaving, error } = useAccountSignOut();
  function synchronize() { void cloud.sync('server').catch(() => undefined); }
  return <View className="gap-6">
    <View className="gap-4">
      {showEmail ? <Text selectable className="text-sm text-muted-foreground">{auth.user?.email}</Text> : null}
      <View className="gap-4">
        <View className="flex-row items-start gap-3 rounded-xl bg-muted/50 p-4"><Icon as={Cloud} size={20} className="text-primary" /><View className="min-w-0 flex-1 gap-1"><Text className="text-sm font-semibold">Adatok szinkronizálása</Text><Text accessibilityLiveRegion="polite" className="text-sm leading-5 text-muted-foreground">{cloud.status}</Text></View></View>
        {cloud.error || error ? <View className="rounded-lg bg-destructive/10 p-3"><Text accessibilityRole="alert" className="text-sm leading-5 text-destructive">{cloud.error || error}</Text></View> : null}
        <Action secondary icon={RefreshCw} disabled={disabled || cloud.busy || leaving} onPress={() => synchronize()}>{cloud.busy ? 'Frissítés…' : 'Adatok frissítése'}</Action>
      </View>
    </View>
    {showSignOut ? <View className="gap-3">
      <Action secondary icon={LogOut} disabled={disabled || cloud.busy || leaving} onPress={() => void signOut()}>{leaving ? 'Kijelentkezés…' : 'Kijelentkezés'}</Action>
    </View> : null}
  </View>;
}
