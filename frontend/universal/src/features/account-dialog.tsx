import createQrCode from 'qrcode-generator';
import { useMemo, useRef, useState } from 'react';
import { View } from 'react-native';
import { Image } from 'expo-image';
import type { ProfileImageAsset } from '@/domain/profile-image';
import { pickProfileImage, uploadProfileImage } from './profile-image-upload';
import { AccountImagePicker } from './account-image-picker';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
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
  const [code, setCode] = useState('');
  const [backupCodes, setBackupCodes] = useState<string[]>([]);
  const [enrollment, setEnrollment] = useState<{ totpURI: string; backupCodes: string[] } | null>(null);
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
  const secret = enrollment ? new URL(enrollment.totpURI).searchParams.get('secret') : null;
  return { backupCodes, setBackupCodes, auth, name, setName, password, setPassword, newPassword, setNewPassword, securityPassword, setSecurityPassword, deletePassword, setDeletePassword, code, setCode, enrollment, setEnrollment, deleteEmail, setDeleteEmail, deleting, setDeleting, busy, message, error, setError, run, update, image, secret };
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
  return <Modal navigation={navigation} scrollToStartKey={section} fixedHeight={setup ? undefined : 560} setup={setup} backwards={setup} dismissible={!setup} title="Fiókbeállítások" description={auth.user?.email} close={busy ? () => undefined : close} header={setup ? <SetupHeader step={0} disabled={busy} onStepChange={step => { if (step === 1) onContinue?.(); }} /> : undefined} footer={setup ? <Action icon={ArrowRight} disabled={busy} onPress={() => onContinue?.()}>Tovább a Profil lépéshez</Action> : undefined}>
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
  const [expanded, setExpanded] = useState<'password' | 'twofactor' | null>(c.enrollment ? 'twofactor' : null);
  function toggle(value: 'password' | 'twofactor') { setExpanded(current => current === value ? null : value); }
  return <View className="gap-3">
    <View className="gap-4"><SecurityRow title="Jelszó módosítása" icon={KeyRound} expanded={expanded === 'password'} disabled={c.busy} onPress={() => toggle('password')} />
      <AnimatedDisclosure expanded={expanded === 'password'} gap={16}><View className="gap-4 px-1 pb-2">
        <PasswordField label="Jelenlegi jelszó" value={c.password} onChange={c.setPassword} />
        <PasswordField label="Új jelszó" value={c.newPassword} onChange={c.setNewPassword} newPassword />
        <Text className="text-xs leading-5 text-muted-foreground">Legalább 8 karakter. A módosítás kijelentkeztet a többi eszközről.</Text>
        <Action icon={Save} disabled={c.busy || !c.password || c.newPassword.length < 8 || c.newPassword.length > 128} onPress={() => void c.run(() => changeAccountPassword(c), 'Jelszó megváltoztatva. Más eszközök kijelentkeztetve.')}>Jelszó mentése</Action>
      </View></AnimatedDisclosure>
    </View>
    <View className="gap-4"><SecurityRow title="Kétlépcsős hitelesítés" icon={ShieldCheck} status={c.auth.user?.twoFactorEnabled ? 'Bekapcsolva' : 'Kikapcsolva'} expanded={expanded === 'twofactor'} disabled={c.busy} onPress={() => toggle('twofactor')} />
      <AnimatedDisclosure expanded={expanded === 'twofactor'} gap={16}><View className="gap-4 px-1 pb-2">
        {c.enrollment ? <>
          <AuthenticatorQr uri={c.enrollment.totpURI} /><Text selectable className="text-sm">Hitelesítő kulcs: {c.secret}</Text>
          <Text className="text-sm leading-5 text-muted-foreground">Olvasd be a QR-kódot a hitelesítő alkalmazásban. Mentsd el a helyreállítási kódokat: mindegyik egyszer használható.</Text>
          <RecoveryCodes codes={c.enrollment.backupCodes} />
          <Input accessibilityLabel="Hatjegyű hitelesítési kód" placeholder="6 jegyű kód" value={c.code} onChangeText={c.setCode} keyboardType="number-pad" autoComplete="one-time-code" />
          <Action icon={ShieldCheck} disabled={c.busy || !/^\d{6}$/.test(c.code)} onPress={() => void c.run(async () => { await backend('/auth/two-factor/verify-totp', 'POST', { code: c.code }); await c.auth.refreshUser(); c.setEnrollment(null); c.setSecurityPassword(''); c.setCode(''); }, 'Kétlépcsős hitelesítés bekapcsolva.')}>Bekapcsolás megerősítése</Action>
        </> : <>
          <Text className="text-sm leading-5 text-muted-foreground">A beállításhoz a jelenlegi jelszavad szükséges.</Text>
          <PasswordField label="Jelszó a hitelesítés beállításához" value={c.securityPassword} onChange={c.setSecurityPassword} />
          <Action icon={ShieldCheck} secondary={Boolean(c.auth.user?.twoFactorEnabled)} disabled={c.busy || !c.securityPassword} onPress={() => void c.run(() => configureAccountTwoFactor(c), c.auth.user?.twoFactorEnabled ? 'Kétlépcsős hitelesítés kikapcsolva.' : 'Add meg a hitelesítő alkalmazás kódját a befejezéshez.')}>{c.auth.user?.twoFactorEnabled ? 'Hitelesítés kikapcsolása' : 'Hitelesítés beállítása'}</Action>
          {c.auth.user?.twoFactorEnabled ? <Action secondary icon={KeyRound} disabled={c.busy || !c.securityPassword} onPress={() => void c.run(async () => { const result = await backend<{ backupCodes: string[] }>('/auth/two-factor/generate-backup-codes', 'POST', { password: c.securityPassword }); c.setBackupCodes(result.backupCodes); c.setSecurityPassword(''); }, 'Új helyreállítási kódok készültek. A korábbi kódok már nem érvényesek.')}>Új helyreállítási kódok</Action> : null}
        </>}
        {c.backupCodes.length ? <><Text className="text-sm text-muted-foreground">Mentsd el a kódokat biztonságos helyre. Mindegyik egyszer használható.</Text><RecoveryCodes codes={c.backupCodes} /></> : null}
      </View></AnimatedDisclosure>
    </View>
  </View>;
}

async function changeAccountPassword(c: AccountControls) {
  await backend('/auth/change-password', 'POST', { currentPassword: c.password, newPassword: c.newPassword, revokeOtherSessions: true });
  c.setPassword(''); c.setNewPassword('');
}

async function configureAccountTwoFactor(c: AccountControls) {
  if (c.auth.user?.twoFactorEnabled) {
    await backend('/auth/two-factor/disable', 'POST', { password: c.securityPassword });
    await c.auth.refreshUser(); c.setSecurityPassword(''); c.setBackupCodes([]);
  } else c.setEnrollment(await backend('/auth/two-factor/enable', 'POST', { password: c.securityPassword, issuer: 'Triton42' }));
}

function SecurityRow({ title, icon, status, expanded, disabled, onPress }: { title: string; icon: LucideIcon; status?: string; expanded: boolean; disabled: boolean; onPress: () => void }) {
  return <Button variant="ghost" accessibilityLabel={title} accessibilityState={{ expanded }} disabled={disabled} onPress={onPress} className="h-auto justify-start gap-3 rounded-xl bg-muted/50 px-4 py-4">
    <Icon as={icon} size={20} className="text-primary" /><View className="min-w-0 flex-1 gap-1"><Text className="text-sm font-semibold">{title}</Text>{status ? <Text className="text-xs text-muted-foreground">{status}</Text> : null}</View><Icon as={expanded ? ChevronUp : ChevronDown} size={16} className="text-muted-foreground" />
  </Button>;
}

function PasswordField({ label, value, onChange, newPassword = false }: { label: string; value: string; onChange: (value: string) => void; newPassword?: boolean }) {
  return <View className="gap-2"><Text className="text-sm font-medium">{label}</Text><Input accessibilityLabel={label} placeholder={newPassword ? 'Legalább 8 karakter' : 'Jelszó'} value={value} onChangeText={onChange} secureTextEntry autoComplete={newPassword ? 'new-password' : 'current-password'} autoCapitalize="none" /></View>;
}

function RecoveryCodes({ codes }: { codes: string[] }) {
  return <View className="rounded-lg bg-muted p-4"><Text selectable className="font-mono text-sm leading-6">{codes.join('\n')}</Text></View>;
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

/** The secret stays on this device; generating the QR never contacts an external service. */
function AuthenticatorQr({ uri }: { uri: string }) {
  const source = useMemo(() => { const code = createQrCode(0, 'M'); code.addData(uri); code.make(); return { uri: code.createDataURL(4, 16) }; }, [uri]);
  return <Image source={source} cachePolicy="none" accessibilityLabel="Hitelesítő alkalmazás QR-kódja" style={{ width: 240, height: 240, backgroundColor: '#ffffff', alignSelf: 'center' }} contentFit="contain" />;
}
