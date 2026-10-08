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

export function ProfilesDialog({ close, onCreated, onImport, required = false, setupProfile, open = true, onAccount }: { open?: boolean; onAccount?: () => void; setupProfile?: Profile; required?: boolean; close: () => void; onCreated: (id: number) => void | Promise<void>; onImport: (id: number) => void }) {
  const app = useApp();
  const [name, setName] = useState(setupProfile?.name ?? '');
  const [editing, setEditing] = useState<number | undefined>(setupProfile?.id);
  const [deleting, setDeleting] = useState<Profile>();
  const [error, setError] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  async function perform(operation: Promise<void>, closeAfter = true) {
    setError(''); setIsSaving(true);
    try { await operation; await app.refresh(); if (closeAfter) close(); }
    catch (error) { setError(error instanceof Error ? error.message : String(error)); }
    finally { setIsSaving(false); }
  }
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
  async function remove(profile: Profile) { setDeleting(undefined); await perform(deleteProfile(profile.id), false); if (editing === profile.id) { setEditing(undefined); setName(''); } }
  const submit = <Button disabled={isSaving || (required && !name.trim())} className={required ? 'h-12 w-full rounded-xl' : 'self-start'} onPress={() => void save()}>{!required ? <Icon as={editing ? Check : Plus} size={18} className="text-primary-foreground" /> : null}<Text>{isSaving ? 'Mentés…' : required && setupProfile ? 'Tovább az importáláshoz' : editing ? 'Átnevezés mentése' : 'Profil létrehozása'}</Text>{required ? <Icon as={ArrowRight} size={18} className="text-primary-foreground" /> : null}</Button>;
  return <Modal open={open} keepMounted={required} footer={required ? submit : undefined} backwards={required && Boolean(setupProfile)} setup={required} header={required ? <SetupHeader step={1} disabled={isSaving} canContinue={Boolean(name.trim())} onStepChange={step => { if (step === 0) onAccount?.(); else if (step === 2) void save(); }} /> : undefined} dismissible={!required} hideHeading={required} title={required ? "Profil létrehozása" : "Órarend profilok"} description={required ? undefined : "Az órarendjeid a fiókodhoz tartoznak, és az eszközeid között szinkronizálódnak."} close={close}>
    {!required ? <View className="gap-3">
      {app.profileList.map(profile => <ProfileRow key={profile.id} profile={profile} exportCalendar={() => void exportIcs(profile, setError)} importCalendar={() => onImport(profile.id)} rename={() => { setEditing(profile.id); setName(profile.name); }} makeOwn={() => void perform(ownProfile(profile.id))} remove={() => setDeleting(profile)} />)}
    </View> : null}
    <View className={required ? 'gap-4 pt-1' : 'gap-3 border-t border-border pt-4'}>
      {required ? <Label nativeID="first-profile-name">Profil neve</Label> : <View className="flex-row items-center justify-between gap-2"><View className="flex-row items-center gap-2"><Icon as={editing ? Pencil : Plus} size={18} className="text-primary" /><Text className="font-semibold">{editing ? 'Profil átnevezése' : 'Új profil'}</Text></View>{editing ? <Button accessibilityLabel="Átnevezés megszakítása" variant="ghost" className="h-9 w-9 border-0 bg-transparent p-0" onPress={() => { setEditing(undefined); setName(''); }}><Icon as={X} size={17} /></Button> : null}</View>}
      <Input aria-labelledby={required ? 'first-profile-name' : undefined} accessibilityLabel={editing ? 'Új profilnév' : 'Új profil neve'} className={required ? `h-12 rounded-lg border-input bg-card px-4 sm:h-12 ${Platform.OS === 'web' ? 'focus-visible:ring-[2px] focus-visible:ring-ring/20' : ''}` : undefined} placeholder={required ? 'Pl. Saját órarendem' : editing ? 'Új profilnév' : 'Új profil neve'} value={name} onChangeText={setName} autoCapitalize="none" onSubmitEditing={() => { if (name.trim()) void save(); }} returnKeyType="done" />
      {!required ? submit : null}
    </View>
    {required ? <SetupProfilePreview name={name} /> : null}
    {error ? <Text accessibilityRole="alert" className="text-destructive">{error}</Text> : null}
    {deleting ? <Confirm title="Profil törlése" description={`A(z) ${deleting.name} összes helyi órája, forrása és módosítása végleg törlődik.`} accept={() => void remove(deleting)} cancel={() => setDeleting(undefined)} /> : null}
  </Modal>;
}
/** Keeps profile identity and ownership above a single row of calendar actions on every platform. */
function ProfileRow({ profile, importCalendar, exportCalendar, rename, makeOwn, remove }: { profile: Profile; importCalendar: () => void; exportCalendar: () => void; rename: () => void; makeOwn: () => void; remove: () => void }) {
  return <View className={`gap-2 border-b border-border py-4 ${profile.isOwn ? 'bg-primary/5' : 'bg-transparent'}`}>
    <View className="flex-row items-center gap-3">
      <View className="h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-transparent"><Icon as={CalendarDays} size={19} className="text-primary" /></View>
      <View className="min-w-0 flex-1 flex-row items-center gap-2"><Text className="shrink font-semibold" numberOfLines={1}>{profile.name}</Text></View>
      <View className="flex-row items-center gap-1 self-start">{profile.isOwn ? <Badge variant="secondary"><Text>Saját</Text></Badge> : null}<Button accessibilityLabel={profile.isOwn ? `${profile.name} a saját profil` : `${profile.name} sajátként jelölése`} accessibilityState={{ selected: Boolean(profile.isOwn) }} variant="ghost" className="h-10 w-10 self-start border-0 bg-transparent p-0" onPress={makeOwn}><Icon as={Star} size={19} className={profile.isOwn ? 'fill-primary text-primary' : 'text-muted-foreground'} /></Button></View>
    </View>
    <View className="flex-row items-center gap-1 border-t border-border/50 pt-2">
      <ProfileAction icon={Pencil} label={`${profile.name} átnevezése`} text="Átnevezés" onPress={rename} />
      <ProfileAction icon={Upload} label={`${profile.name} órarend importálása`} text="Import" onPress={importCalendar} />
      <ProfileAction icon={Download} label={`${profile.name} ICS exportálása`} text="Export" onPress={exportCalendar} />
      <ProfileAction icon={Trash2} label={`${profile.name} törlése`} text="Törlés" destructive onPress={remove} />
    </View>
  </View>;
}
function ProfileAction({ icon, label, text, destructive = false, onPress }: { icon: typeof Pencil; label: string; text: string; destructive?: boolean; onPress: () => void }) {
  return <Button accessibilityLabel={label} variant="ghost" style={{ paddingHorizontal: 0 }} className="h-12 min-w-0 flex-1 flex-col gap-1 rounded-lg border-0 bg-transparent px-0" onPress={onPress}><Icon as={icon} size={17} className={destructive ? 'text-destructive' : 'text-muted-foreground'} /><Text numberOfLines={1} style={{ fontSize: 12, lineHeight: 16 }} className={`text-center ${destructive ? 'text-destructive' : ''}`}>{text}</Text></Button>;
}

async function exportIcs(profile: Profile, setError: (message: string) => void) {
    setError('');
    try { await exportProfile(profile); }
    catch (error) { setError(error instanceof Error ? error.message : String(error)); }
  }
