import { useState } from 'react';
import { View } from 'react-native';
import { Text } from '@/components/ui/text';
import { Badge } from '@/components/ui/badge';
import { deleteProfile, ownProfile, saveProfile } from '../data/repository';
import type { Profile } from '../domain/model';
import { Action, Confirm, Field, Modal } from './controls';
import { useApp } from './app-state';

export function ProfilesDialog({ close }: { close: () => void }) {
  const app = useApp();
  const [name, setName] = useState('');
  const [editing, setEditing] = useState<number>();
  const [deleting, setDeleting] = useState<Profile>();
  const [error, setError] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  async function perform(operation: Promise<void>, closeAfterSave = false) {
    setError(''); setIsSaving(true);
    try { await operation; await app.refresh(); setName(''); setEditing(undefined); if (closeAfterSave) close(); }
    catch (error) { setError(error instanceof Error ? error.message : String(error)); }
    finally { setIsSaving(false); }
  }
  async function remove(profile: Profile) { setDeleting(undefined); await perform(deleteProfile(profile.id)); }
  return <Modal title="Órarendprofilok" description="Helyi órarendek, fiók és bejelentkezés nélkül." close={close}>
    {app.profileList.map(profile => <View key={profile.id} className="gap-2 rounded-lg border border-border p-3">
      <View className="flex-row items-center gap-2"><Text className="font-semibold">{profile.name}</Text>{profile.isOwn ? <Badge><Text>Saját</Text></Badge> : null}</View>
      <View className="flex-row flex-wrap gap-2"><Action secondary onPress={() => { setEditing(profile.id); setName(profile.name); }}>Átnevezés</Action><Action secondary onPress={() => void perform(ownProfile(profile.id))}>Sajátként jelölés</Action><Action secondary onPress={() => setDeleting(profile)}>Törlés</Action></View>
    </View>)}
    <Field label={editing ? 'Új profilnév' : 'Új profil neve'} value={name} onChange={setName} />
    <Action disabled={isSaving} onPress={() => void perform(saveProfile(name, editing), editing === undefined)}>{editing ? 'Átnevezés mentése' : 'Profil létrehozása'}</Action>
    {error ? <Text accessibilityRole="alert" className="text-destructive">{error}</Text> : null}
    {deleting ? <Confirm title="Profil törlése" description={`A(z) ${deleting.name} összes helyi órája, forrása és módosítása végleg törlődik.`} accept={() => void remove(deleting)} cancel={() => setDeleting(undefined)} /> : null}
  </Modal>;
}
