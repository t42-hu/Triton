import { useState } from 'react';
import { Text } from '@/components/ui/text';
import { useAuth } from './auth-state';
import { Action, Modal } from './controls';
import { SetupShell } from './setup-shell';
import { SetupHeader } from './setup-header';
export function LegacyDataScreen() {
  const auth = useAuth(); const [busy, setBusy] = useState(false); const [error, setError] = useState('');
  async function choose(include: boolean) {
    setBusy(true); setError('');
    try { await auth.finishSetup(include); }
    catch (error) { setError(error instanceof Error ? error.message : String(error)); }
    finally { setBusy(false); }
  }
  return <SetupShell><Modal setup dismissible={false} close={() => undefined} title="Korábbi órarendek átvitele" description={`Ezen az eszközön ${auth.legacyCount} korábban létrehozott profil található. Átviszed őket a(z) ${auth.user?.email} fiókba?`} header={<SetupHeader step={1} disabled />} footer={<><Action disabled={busy} onPress={() => void choose(true)}>Helyi profilok átvitele</Action><Action secondary disabled={busy} onPress={() => void choose(false)}>Csak a fiókom adatait használom</Action></>}><Text>A korábbi helyi példány megmarad. Az átvitt órarendeket és beállításokat a fiókodba mentjük.</Text>{error ? <Text className="text-destructive">{error}</Text> : null}</Modal></SetupShell>;
}
