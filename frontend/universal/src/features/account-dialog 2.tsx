import { useRef, useState } from 'react';
import { View } from 'react-native';
import type { ProfileImageAsset } from '@/domain/profile-image';
import { pickProfileImage, uploadProfileImage } from './profile-image-upload';
import { AccountImagePicker } from './account-image-picker';
import { PasswordInput } from '@/components/ui/password-input';
import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Switch } from '@/components/ui/switch';
import { Text } from '@/components/ui/text';
import { eraseAccountDatabase } from '@/data/database';
import { backend } from '@/data/backend';
import { Action, Field, Modal } from './controls';
import { SetupHeader } from './setup-header';
import { ArrowRight, Check, ChevronDown, ChevronUp, KeyRound, Save, ShieldCheck, Trash2, type LucideIcon } from 'lucide-react-native';
import { AnimatedDisclosure } from './animated-disclosure';
import { AccountSettings } from './account-settings';
import { useAuth } from './auth-state';
function useAccountControls() {
  const auth = useAuth();
  const [name, setName] = useState(auth.user?.name ?? '');
  const [password, setPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [securityPassword, setSecurityPassword] = useState('');
  const [deletePassword, setDeletePassword] = useState('');
  const [deleteEmail, setDeleteEmail] = useState('');
  const [deleting, setDeleting] = useState(false);
  const [busy, setBusy] = useState(false);
  const running = useRef(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  async function run(operation: () => Promise<void>, success: string) {
    if (running.current) return; running.current = true; setBusy(true); setError(''); setMessage('');
    try { await operation(); setMessage(success); }
    catch (error) { setError(error instanceof Error ? error.message : String(error)); }
    finally { running.current = false; setBusy(false); }
  }
  async function update(body: { name?: string; imageKey?: string | null }) { await backend('/users/me', 'PATCH', body); await auth.refreshUser(); }
  async function image(asset?: ProfileImageAsset) {
    const selected = asset ?? await pickProfileImage();
    if (selected) await update({ imageKey: await uploadProfileImage(selected) });
  }
  return { securityPassword, setSecurityPassword, auth, name, setName, password, setPassword, newPassword, setNewPassword, deletePassword, setDeletePassword, deleteEmail, setDeleteEmail, deleting, setDeleting, busy, message, error, setError, run, update, image };
}
type AccountControls = ReturnType<typeof useAccountControls>;

export function AccountDialog({ close, setup = false, onContinue }: { close: () => void; setup?: boolean; onContinue?: () => void }) {
  const controls = useAccountControls();
  const [section, setSection] = useState('profile');
  const { auth, busy, error, message } = controls;
  const navigation = <Tabs value={section} onValueChange={setSection}><TabsList className="w-full border-0 bg-muted">
      <TabsTrigger value="profile" disabled={busy} className="flex-1 px-1"><Text>Profil</Text></TabsTrigger>
      <TabsTrigger value="security" disabled={busy} className="flex-1 px-1"><Text>Biztonság</Text></TabsTrigger>
      <TabsTrigger value="account" disabled={busy} className="flex-1 px-1"><Text>Fiók</Text></TabsTrigger>
    </TabsList></Tabs>;
  return <Modal navigation={navigation} scrollToStartKey={section} setup={setup} backwards={setup} dismissible={!setup} title="Fiókbeállítások" description={auth.user?.email} close={busy ? () => undefined : close} header={setup ? <SetupHeader step={0} disabled={busy} onStepChange={step => { if (step === 1) onContinue?.(); }} /> : undefined} footer={setup ? <Action icon={ArrowRight} disabled={busy} onPress={() => onContinue?.()}>Tovább a Profil lépéshez</Action> : undefined}>
    {error ? <View className="rounded-lg bg-destructive/10 p-3"><Text accessibilityRole="alert" className="text-sm text-destructive">{error}</Text></View> : message ? <View className="flex-row items-start gap-2 rounded-lg bg-primary/5 p-3"><Icon as={Check} size={16} className="text-primary" /><Text accessibilityLiveRegion="polite" className="min-w-0 flex-1 text-sm">{message}</Text></View> : null}
    {section === 'profile' ? <AccountProfile controls={controls} /> : null}
    {section === 'security' ? <AccountSecurity controls={controls} /> : null}
    {section === 'account' ? <View className="gap-6"><AccountSettings disabled={busy} showEmail={false} /><AccountDeletion controls={controls} /></View> : null}
  </Modal>;
}

function AccountProfile({ controls: c }: { controls: AccountControls }) {
  return <View className="gap-6">
    <AccountImagePicker image={c.auth.user?.image} name={c.name} busy={c.busy} choose={() => void c.run(() => c.image(), 'Fiókkép mentve.')} receive={asset => void c.run(() => c.image(asset), 'Fiókkép mentve.')} reportError={c.setError} remove={() => void c.run(() => c.update({ imageKey: null }), 'Fiókkép törölve.')} />
    <View className="gap-4"><Field label="Megjelenített név" value={c.name} onChange={c.setName} /><View className="self-end"><Action icon={Save} disabled={c.busy || c.name.trim() === c.auth.user?.name || c.name.trim().length < 2 || c.name.trim().length > 50} onPress={() => void c.run(() => c.update({ name: c.name.trim() }), 'Név mentve.')}>Név mentése</Action></View></View>
  </View>;
}

function AccountSecurity({ controls: c }: { controls: AccountControls }) {
  const [expanded, setExpanded] = useState<'password' | 'twofactor' | null>(null);
  const twoFactorEnabled = c.auth.user?.twoFactorEnabled === true;
  function toggle(value: 'password' | 'twofactor') { setExpanded(current => current === value ? null : value); }
  return <View className="gap-3">
    <View className="gap-4"><SecurityRow title="Jelszó módosítása" icon={KeyRound} expanded={expanded === 'password'} disabled={c.busy} onPress={() => toggle('password')} />
      <AnimatedDisclosure expanded={expanded === 'password'} gap={16}><View className="gap-4 px-1 pb-2">
        <PasswordField label="Jelenlegi jelszó" value={c.password} onChange={c.setPassword} />
        <PasswordField label="Új jelszó" value={c.newPassword} onChange={c.setNewPassword} newPassword />
        <Text className="text-xs leading-5 text-muted-foreground">Legalább 8 karakter. Az új jelszó csak emailes jóváhagyás után lép életbe, a 2FA állapotától függetlenül. Utána a többi eszközről kijelentkeztetünk.</Text>
        <Action icon={Save} disabled={c.busy || !c.password || c.newPassword.length < 8 || c.newPassword.length > 128} onPress={() => void c.run(() => changeAccountPassword(c), 'Megerősítő email elküldve. A hivatkozás 10 percig érvényes. A jóváhagyásig a régi jelszó marad érvényes.')}>Megerősítő email küldése</Action>
      </View></AnimatedDisclosure>
    </View>
    <View className="gap-4"><SecurityRow title="Kétlépcsős hitelesítés" icon={ShieldCheck} status={twoFactorEnabled ? 'Bekapcsolva' : 'Kikapcsolva'} expanded={expanded === 'twofactor'} disabled={c.busy} onPress={() => toggle('twofactor')} />
      <AnimatedDisclosure expanded={expanded === 'twofactor'} gap={16}><View className="gap-4 px-1 pb-2">
        <Text className="text-sm leading-6">Bekapcsolva minden jelszavas belépés után emailt küldünk a fiókod címére. Az emailben lévő „Bejelentkezés jóváhagyása” gombbal fejezheted be a belépést.</Text>
        <Text className="text-sm leading-6 text-muted-foreground">A hivatkozás egyszer használható és 10 percig érvényes. Nincs szükség hitelesítő alkalmazásra. Kikapcsolva a belépéshez elegendő a jelszavad.</Text>
        <PasswordField label="Jelenlegi jelszó a 2FA módosításához" value={c.securityPassword} onChange={c.setSecurityPassword} />
        <View className="min-h-14 flex-row items-center justify-between gap-4 border-t border-border py-3">
          <View className="min-w-0 flex-1 gap-1">
            <Text className="text-sm font-medium">Emailes belépés-jóváhagyás</Text>
            <Text className="text-xs text-muted-foreground">{twoFactorEnabled ? 'Bekapcsolva' : 'Kikapcsolva'}</Text>
          </View>
          <Switch accessibilityLabel="Kétlépcsős hitelesítés" accessibilityHint="A módosításhoz add meg a jelenlegi jelszavad." checked={twoFactorEnabled} disabled={c.busy || !c.securityPassword} onCheckedChange={enabled => void c.run(async () => {
          await backend('/auth/two-factor/email/settings', 'POST', { enabled, password: c.securityPassword });
          c.setSecurityPassword(''); await c.auth.refreshUser();
        }, enabled ? 'Kétlépcsős hitelesítés bekapcsolva.' : 'Kétlépcsős hitelesítés kikapcsolva.')} />
        </View>
      </View></AnimatedDisclosure>
    </View>
  </View>;
}

async function changeAccountPassword(c: AccountControls) {
  await backend('/auth/change-password', 'POST', { currentPassword: c.password, newPassword: c.newPassword, revokeOtherSessions: true });
  c.setPassword(''); c.setNewPassword('');
}

function SecurityRow({ title, icon, status, expanded, disabled, onPress }: { title: string; icon: LucideIcon; status?: string; expanded: boolean; disabled: boolean; onPress: () => void }) {
  return <Button variant="ghost" accessibilityLabel={title} accessibilityState={{ expanded }} disabled={disabled} onPress={onPress} className="h-auto justify-start gap-3 rounded-xl bg-muted/50 px-4 py-4">
    <Icon as={icon} size={20} className="text-primary" /><View className="min-w-0 flex-1 gap-1"><Text className="text-sm font-semibold">{title}</Text>{status ? <Text className="text-xs text-muted-foreground">{status}</Text> : null}</View><Icon as={expanded ? ChevronUp : ChevronDown} size={16} className="text-muted-foreground" />
  </Button>;
}

function PasswordField({ label, value, onChange, newPassword = false }: { label: string; value: string; onChange: (value: string) => void; newPassword?: boolean }) {
  return <View className="gap-2"><Text className="text-sm font-medium">{label}</Text><PasswordInput accessibilityLabel={label} placeholder={newPassword ? 'Legalább 8 karakter' : 'Jelszó'} value={value} onChangeText={onChange} autoComplete={newPassword ? 'new-password' : 'current-password'} autoCapitalize="none" /></View>;
}

function AccountDeletion({ controls: c }: { controls: AccountControls }) {
  return <View className="gap-4 border-t border-border pt-5">
    <Button variant="ghost" disabled={c.busy} accessibilityState={{ expanded: c.deleting }} onPress={() => c.setDeleting(!c.deleting)} className="justify-start gap-3 px-1"><Icon as={Trash2} size={18} className="text-destructive" /><Text className="min-w-0 flex-1 text-destructive">Fiók törlése</Text><Icon as={c.deleting ? ChevronUp : ChevronDown} size={16} className="text-muted-foreground" /></Button>
    <AnimatedDisclosure expanded={c.deleting} gap={16}><View className="gap-4 rounded-xl bg-destructive/5 p-4">
      <Text className="text-sm leading-5 text-destructive">A fiók és minden hozzá tartozó adat végleg törlődik. Ez nem vonható vissza.</Text>
      <Field label="Megerősítés: email-cím" value={c.deleteEmail} onChange={c.setDeleteEmail} placeholder={c.auth.user?.email} />
      <PasswordField label="Jelszó a fiók törléséhez" value={c.deletePassword} onChange={c.setDeletePassword} />
      <Button variant="destructive" disabled={c.busy || !c.deletePassword || c.deleteEmail !== c.auth.user?.email} onPress={() => void c.run(async () => { const id = c.auth.user!.id; await backend('/auth/delete-user', 'POST', { password: c.deletePassword }); await c.auth.clearAccount(); await eraseAccountDatabase(id); }, '')}><Icon as={Trash2} size={17} className="text-white" /><Text>Fiók végleges törlése</Text></Button>
      <Action secondary disabled={c.busy} onPress={() => c.setDeleting(false)}>Mégse</Action>
    </View></AnimatedDisclosure>
  </View>;
}
