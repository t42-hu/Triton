import { useState } from 'react';
import { View, useWindowDimensions } from 'react-native';
import { CalendarDays, Check, Pencil, Plus, Star, Trash2, X } from 'lucide-react-native';
import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { Badge } from '@/components/ui/badge';
import { deleteProfile, ownProfile, saveProfile } from '../data/repository';
import type { Profile } from '../domain/model';
import { Confirm, Field, Modal } from './controls';
import { useApp } from './app-state';

export function ProfilesDialog({ close, onCreated }: { close: () => void; onCreated: (id: number) => void }) {
  const app = useApp();
  const [name, setName] = useState('');
  const [editing, setEditing] = useState<number>();
  const [deleting, setDeleting] = useState<Profile>();
  const [error, setError] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const { width } = useWindowDimensions();
  const compact = width < 600;
  async function perform(operation: Promise<void>) {
    setError(''); setIsSaving(true);
    try { await operation; await app.refresh(); close(); }
    catch (error) { setError(error instanceof Error ? error.message : String(error)); }
    finally { setIsSaving(false); }
  }
  async function save() {
    setError(''); setIsSaving(true);
    try {
      const id = await saveProfile(name, editing);
      await app.refresh(); setName(''); setEditing(undefined);
      if (editing === undefined) onCreated(id); else close();
    } catch (error) { setError(error instanceof Error ? error.message : String(error)); }
    finally { setIsSaving(false); }
  }
  async function remove(profile: Profile) { setDeleting(undefined); await perform(deleteProfile(profile.id)); }
  return <Modal title="Órarendprofilok" description="Az órarendjeid ezen az eszközön vannak." close={close}>
    <View className="overflow-hidden rounded-xl border border-border bg-background/40">
      {app.profileList.map(profile => <ProfileRow key={profile.id} profile={profile} compact={compact} rename={() => { setEditing(profile.id); setName(profile.name); }} makeOwn={() => void perform(ownProfile(profile.id))} remove={() => setDeleting(profile)} />)}
    </View>
    <View className="gap-3 rounded-xl bg-muted p-4">
      <View className="flex-row items-center justify-between gap-2"><View className="flex-row items-center gap-2"><Icon as={editing ? Pencil : Plus} size={18} className="text-primary" /><Text className="font-semibold">{editing ? 'Profil átnevezése' : 'Új profil'}</Text></View>{editing ? <Button accessibilityLabel="Átnevezés megszakítása" variant="ghost" className="h-9 w-9 border-0 bg-transparent p-0" onPress={() => { setEditing(undefined); setName(''); }}><Icon as={X} size={17} /></Button> : null}</View>
      <Field label={editing ? 'Új profilnév' : 'Új profil neve'} value={name} onChange={setName} />
      <Button disabled={isSaving} className="self-start" onPress={() => void save()}><Icon as={editing ? Check : Plus} size={18} className="text-primary-foreground" /><Text>{editing ? 'Átnevezés mentése' : 'Profil létrehozása'}</Text></Button>
    </View>
    {error ? <Text accessibilityRole="alert" className="text-destructive">{error}</Text> : null}
    {deleting ? <Confirm title="Profil törlése" description={`A(z) ${deleting.name} összes helyi órája, forrása és módosítása végleg törlődik.`} accept={() => void remove(deleting)} cancel={() => setDeleting(undefined)} /> : null}
  </Modal>;
}
function ProfileRow({ profile, compact, rename, makeOwn, remove }: { profile: Profile; compact: boolean; rename: () => void; makeOwn: () => void; remove: () => void }) {
  const identity = <View className="min-w-0 flex-1 flex-row items-center gap-3">{compact ? null : <View className="h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-muted"><Icon as={CalendarDays} size={19} className="text-primary" /></View>}<Text className="shrink font-semibold" numberOfLines={1}>{profile.name}</Text>{profile.isOwn ? <Badge variant="secondary"><Text>Saját</Text></Badge> : null}</View>;
  const actions = <View className="flex-row items-center gap-1"><ProfileAction icon={Pencil} label={`${profile.name} átnevezése`} text="Átnevezés" compact={compact} onPress={rename} />{profile.isOwn ? null : <ProfileAction icon={Star} label={`${profile.name} sajátként jelölése`} text="Sajátként" compact={compact} onPress={makeOwn} />}<ProfileAction icon={Trash2} label={`${profile.name} törlése`} text="Törlés" compact={compact} destructive onPress={remove} /></View>;
  return <View className="flex-row items-center justify-between gap-2 border-b border-border px-3 py-2.5 last:border-b-0">
    {identity}{actions}
  </View>;
}
function ProfileAction({ icon, label, text, compact, destructive = false, onPress }: { icon: typeof Pencil; label: string; text: string; compact: boolean; destructive?: boolean; onPress: () => void }) {
  return <Button accessibilityLabel={label} hitSlop={2} variant="ghost" className={`rounded-lg border-0 bg-transparent ${compact ? 'h-10 w-10 p-0' : 'h-10 px-2'}`} onPress={onPress}><Icon as={icon} size={17} className={destructive ? 'text-destructive' : 'text-muted-foreground'} />{compact ? null : <Text className={destructive ? 'text-destructive' : 'text-sm'}>{text}</Text>}</Button>;
}
