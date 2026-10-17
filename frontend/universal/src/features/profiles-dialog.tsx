import { SetupProfilePreview } from './setup-profile-preview';
import { SetupHeader } from './setup-header';
import { Input } from '@/components/ui/input';
import { useState } from 'react';
import { Platform, View } from 'react-native';
import { ArrowRight, CalendarDays, Download, Check, Pencil, Plus, Star, Trash2, Upload, X } from 'lucide-react-native';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { Badge } from '@/components/ui/badge';
import { deleteProfile, ownProfile, saveProfile } from '../data/repository';
import { exportProfile } from '../data/calendar-export';
import type { Profile } from '../domain/model';
import { Confirm, Modal } from './controls';
import { useApp } from './app-state';
import { useOptimisticRemoval } from './use-optimistic-removal';

export function ProfilesDialog({ close, onCreated, onImport, required = false, setupProfile, open = true, onAccount }: { open?: boolean; onAccount?: () => void; setupProfile?: Profile; required?: boolean; close: () => void; onCreated: (id: number) => void | Promise<void>; onImport: (id: number) => void }) {
  const app = useApp(); const removal = useOptimisticRemoval<number>();
  const [name, setName] = useState(setupProfile?.name ?? ''); const [editing, setEditing] = useState<number | undefined>(setupProfile?.id);
  const [renameScrollKey, setRenameScrollKey] = useState<number>();
  const [deleting, setDeleting] = useState<Profile>(); const [error, setError] = useState(''); const [isSaving, setIsSaving] = useState(false);
  const perform = (operation: Promise<void>, closeAfter = true) => performProfileOperation(operation, () => app.refresh(), close, setError, setIsSaving, closeAfter);
  async function save() {
    if (isSaving) return;
    setError(''); setIsSaving(true);
    try {
      const id = await saveProfile(name, editing, required);
      if (required) { await onCreated(id); return; }
      await app.refresh(); setName(''); setEditing(undefined);
      if (editing === undefined) onCreated(id); else close();
    } catch (error) { setError(error instanceof Error ? error.message : String(error)); }
    finally { setIsSaving(false); }
  }
  async function remove(profile: Profile) { setDeleting(undefined); setError('');
    try { await removal.remove(profile.id, () => deleteProfile(profile.id)); await app.refresh(); if (editing === profile.id) { setEditing(undefined); setName(''); } }
    catch (reason) { setError(reason instanceof Error ? reason.message : String(reason)); }
  }
  const submit = <Button disabled={isSaving || (required && !name.trim())} className={required ? 'h-12 w-full rounded-xl' : 'self-start'} onPress={() => void save()}>{!required ? <Icon as={editing ? Check : Plus} size={18} className="text-primary-foreground" /> : null}<Text>{isSaving ? 'Mentés…' : required && setupProfile ? 'Tovább az importáláshoz' : editing ? 'Átnevezés mentése' : 'Profil létrehozása'}</Text>{required ? <Icon as={ArrowRight} size={18} className="text-primary-foreground" /> : null}</Button>;
  return <Modal open={open} keepMounted={required} footer={required ? submit : undefined} backwards={required && Boolean(setupProfile)} setup={required} scrollToEndKey={required ? undefined : renameScrollKey} header={required ? <SetupHeader step={1} disabled={isSaving} canContinue={Boolean(name.trim())} onStepChange={step => { if (step === 0) onAccount?.(); else if (step === 2) void save(); }} /> : undefined} dismissible={!required} hideHeading={required} title={required ? "Profil létrehozása" : "Órarend profilok"} description={required ? undefined : "Az órarendjeid a fiókodhoz tartoznak, és az eszközeid között szinkronizálódnak."} close={close}>
    {!required ? <View className="gap-0">
      {app.profileList.filter(profile => !removal.removed.has(profile.id)).map(profile => <ProfileRow key={profile.id} profile={profile} exportCalendar={() => void exportIcs(profile, setError)} importCalendar={() => onImport(profile.id)} rename={() => { setEditing(profile.id); setName(profile.name); setRenameScrollKey(key => (key ?? 0) + 1); }} makeOwn={() => void perform(ownProfile(profile.id))} remove={() => setDeleting(profile)} />)}
    </View> : null}
    <View className={required ? 'gap-4 pt-1' : 'gap-3 pt-2'}>
      {required ? <Label nativeID="first-profile-name">Profil neve</Label> : <View className="flex-row items-center justify-between gap-2"><View className="flex-row items-center gap-2"><Icon as={editing ? Pencil : Plus} size={18} className="text-primary" /><Text className="font-semibold">{editing ? 'Profil átnevezése' : 'Új profil'}</Text></View>{editing ? <Button accessibilityLabel="Átnevezés megszakítása" variant="ghost" className="h-9 w-9 border-0 bg-transparent p-0" onPress={() => { setEditing(undefined); setName(''); }}><Icon as={X} size={17} /></Button> : null}</View>}
      <Input aria-labelledby={required ? 'first-profile-name' : undefined} accessibilityLabel={editing ? 'Új profilnév' : 'Új profil neve'} className={required ? `h-12 rounded-lg border-input bg-card px-4 sm:h-12 ${Platform.OS === 'web' ? 'focus-visible:ring-[2px] focus-visible:ring-ring/20' : ''}` : undefined} placeholder={required ? 'Pl. Saját órarendem' : editing ? 'Új profilnév' : 'Új profil neve'} value={name} onChangeText={setName} autoCapitalize="none" onSubmitEditing={() => { if (name.trim()) void save(); }} returnKeyType="done" />
      {!required ? submit : null}
    </View>
    {required ? <SetupProfilePreview name={name} /> : null}
    {error ? <Text accessibilityRole="alert" className="text-destructive">{error}</Text> : null}
    {deleting ? <Confirm title="Profil törlése" description={`A(z) ${deleting.name} összes órája, forrása és módosítása végleg törlődik.`} accept={() => void remove(deleting)} cancel={() => setDeleting(undefined)} /> : null}
  </Modal>;
}
async function performProfileOperation(operation: Promise<void>, refresh: () => Promise<void>, close: () => void, setError: (error: string) => void, setIsSaving: (saving: boolean) => void, closeAfter: boolean) {
  setError(''); setIsSaving(true);
  try { await operation; await refresh(); if (closeAfter) close(); }
  catch (error) { setError(error instanceof Error ? error.message : String(error)); }
  finally { setIsSaving(false); }
}
/** Keeps each profile compact while preserving clear, screen-reader-labeled actions. */
function ProfileRow({ profile, importCalendar, exportCalendar, rename, makeOwn, remove }: { profile: Profile; importCalendar: () => void; exportCalendar: () => void; rename: () => void; makeOwn: () => void; remove: () => void }) {
  return <View className="flex-row flex-wrap items-center justify-between gap-2 border-b border-border py-2.5">
    <View className="min-w-[190px] flex-1 flex-row items-center gap-3">
      <View className="h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-accent"><Icon as={CalendarDays} size={18} className="text-primary" /></View>
      <Text className="min-w-0 flex-1 font-semibold" numberOfLines={1}>{profile.name}</Text>
      {profile.isOwn ? <Badge variant="secondary" className="px-2.5"><Text>Saját</Text></Badge> : <Button accessibilityLabel={`${profile.name} sajátként jelölése`} accessibilityHint="Ezt állítja be saját órarendként." variant="ghost" className="h-11 w-11 border-0 bg-transparent p-0" onPress={makeOwn}><Icon as={Star} size={18} className="text-muted-foreground" /></Button>}
    </View>
    <View className="ml-auto flex-row shrink-0 items-center gap-1">
      <ProfileAction icon={Pencil} label={`${profile.name} átnevezése`} hint="Megnyitja a profil átnevezését." onPress={rename} />
      <ProfileAction icon={Upload} label={`${profile.name} órarend importálása`} hint="Órarendet importál ebbe a profilba." onPress={importCalendar} />
      {profile.isOwn ? <ProfileAction icon={Download} label={`${profile.name} ICS exportálása`} hint="ICS fájlként exportálja ezt az órarendet." onPress={exportCalendar} /> : null}
      <ProfileAction icon={Trash2} label={`${profile.name} törlése`} hint="Megerősítés után törli ezt a profilt." destructive onPress={remove} />
    </View>
  </View>;
}
function ProfileAction({ icon, label, hint, destructive = false, onPress }: { icon: typeof Pencil; label: string; hint: string; destructive?: boolean; onPress: () => void }) {
  return <Button accessibilityLabel={label} accessibilityHint={hint} variant="ghost" className="h-11 w-11 rounded-lg border-0 bg-transparent p-0" onPress={onPress}><Icon as={icon} size={17} className={destructive ? 'text-destructive' : 'text-muted-foreground'} /></Button>;
}

async function exportIcs(profile: Profile, setError: (message: string) => void) {
    setError('');
    try { await exportProfile(profile); }
    catch (error) { setError(error instanceof Error ? error.message : String(error)); }
  }
