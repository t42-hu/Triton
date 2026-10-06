import { useEffect, useState, type ReactNode } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/text';
import { saveSetting } from '@/data/database';
import { requiredImportProfile } from '@/data/required-setup';
import type { Profile } from '@/domain/model';
import { useApp } from './app-state';
import { ProfilesDialog } from './profiles-dialog';
import { ImportDialog } from './import-dialog';

/** Keeps navigation unmounted until the first profile and its import are complete. */
export function WorkspaceSetupGate({ children }: { children: ReactNode }) {
  const app = useApp();
  const setup = useRequiredSetup();
  if (setup.isChecking) return <View className="flex-1 items-center justify-center bg-background"><ActivityIndicator /></View>;
  if (setup.error) return <View className="flex-1 items-center justify-center gap-4 bg-background p-6"><Text accessibilityRole="alert">{setup.error}</Text><Button onPress={setup.retry}><Text>Újrapróbálás</Text></Button></View>;
  if (setup.isCreating || !app.profileList.length) return <View className="flex-1 bg-background"><ProfilesDialog required close={ignoreDismissal} onCreated={setup.created} onImport={ignoreDismissal} /></View>;
  if (setup.profileId !== null) return <View className="flex-1 bg-background"><ImportDialog required profileId={setup.profileId} close={setup.completed} /></View>;
  return children;
}

/** Persists the required import so reloading cannot bypass setup. */
function useRequiredSetup() {
  const app = useApp();
  const [isChecking, setIsChecking] = useState(true);
  const [isCreating, setIsCreating] = useState(!app.profileList.length);
  const [profileId, setProfileId] = useState<number | null>(null);
  const [error, setError] = useState('');
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let cancelled = false;
    async function restore() {
      try {
        const pending = await requiredImportProfile(app.profileList.map(profileIdentifier));
        if (!cancelled) setProfileId(pending);
      } catch (error) { if (!cancelled) setError(error instanceof Error ? error.message : String(error)); }
      finally { if (!cancelled) setIsChecking(false); }
    }
    void restore();
    return () => { cancelled = true; };
  }, [app.profileList, attempt]);
  async function created(id: number) {
    await app.refresh();
    setProfileId(id); setIsCreating(false);
  }
  async function complete() { await saveSetting('setupProfileId', null); setProfileId(null); }
  function completed() { void complete().catch(error => setError(error instanceof Error ? error.message : String(error))); }
  function retry() { setIsChecking(true); setError(''); setAttempt(value => value + 1); }
  return { isChecking, isCreating, profileId, error, created, completed, retry };
}

function ignoreDismissal() {}

/** Selects persisted profile IDs without capturing changing UI state. */
function profileIdentifier(profile: Profile) { return profile.id; }
