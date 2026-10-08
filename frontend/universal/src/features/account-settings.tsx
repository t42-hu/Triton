import { useState } from 'react';
import { View } from 'react-native';
import { LogOut, RefreshCw } from 'lucide-react-native';
import { Text } from '@/components/ui/text';
import { Action, Confirm } from './controls';
import { useApp } from './app-state';
import { useAuth } from './auth-state';
import { useAccountSignOut } from './use-account-sign-out';
export function AccountSettings({ disabled = false, showSignOut = true }: { disabled?: boolean; showSignOut?: boolean }) {
  const auth = useAuth(); const { cloud } = useApp();
  const [resolution, setResolution] = useState<'local' | 'server' | null>(null);
  const { signOut, leaving, error } = useAccountSignOut();
  function synchronize(choice?: 'local' | 'server') { setResolution(null); void cloud.sync(choice).catch(() => undefined); }
  return <View className="gap-6">
    <View className="gap-4">
      <Text selectable className="text-sm text-muted-foreground">{auth.user?.email}</Text>
      <View className="gap-3 border-t border-border pt-4">
        <Text accessibilityLiveRegion="polite" className="text-sm leading-5 text-muted-foreground">{cloud.status}</Text>
        {cloud.error || error ? <View className="rounded-lg bg-destructive/10 p-3"><Text accessibilityRole="alert" className="text-sm leading-5 text-destructive">{cloud.error || error}</Text></View> : null}
        <Action secondary icon={RefreshCw} disabled={disabled || cloud.busy || leaving} onPress={() => synchronize()}>{cloud.busy ? 'Szinkronizálás…' : 'Szinkronizálás'}</Action>
        {cloud.error.includes('másik eszköz') ? <View className="gap-3"><Text className="text-xs leading-5 text-muted-foreground">Válaszd ki, melyik változatot szeretnéd megtartani.</Text><Action secondary disabled={disabled || cloud.busy} onPress={() => setResolution('server')}>Szerver változatának betöltése</Action><Action secondary disabled={disabled || cloud.busy} onPress={() => setResolution('local')}>Helyi változat megtartása</Action></View> : null}
      </View>
    </View>
    {showSignOut ? <View className="gap-3 border-t border-border pt-5">
      <Action secondary icon={LogOut} disabled={disabled || cloud.busy || leaving} onPress={() => void signOut()}>{leaving ? 'Kijelentkezés…' : 'Kijelentkezés'}</Action>
    </View> : null}
    {resolution ? <Confirm title="Szinkronizálási ütközés feloldása" description={resolution === 'server' ? 'A szerveren mentett adatokat töltjük be. A függőben lévő helyi módosítások helyére ezek kerülnek.' : 'A helyi változtatásokat töltjük fel a szerveren időközben módosított adatok helyére.'} accept={() => synchronize(resolution)} cancel={() => setResolution(null)} /> : null}
  </View>;
}
