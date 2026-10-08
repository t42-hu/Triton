import createQrCode from 'qrcode-generator';
import { useMemo, useRef, useState } from 'react';
import { View } from 'react-native';
import { Image } from 'expo-image';
import type { ProfileImageAsset } from '@/domain/profile-image';
import { pickProfileImage, uploadProfileImage } from './profile-image-upload';
import { AccountImagePicker } from './account-image-picker';
import { Input } from '@/components/ui/input';
import { Text } from '@/components/ui/text';
import { eraseAccountDatabase } from '@/data/database';
import { backend } from '@/data/backend';
import { Action, Field, Modal } from './controls';
import { SetupHeader } from './setup-header';
import { ArrowRight } from 'lucide-react-native';
import { AccountSettings } from './account-settings';
import { useAuth } from './auth-state';
function useAccountControls() {
  const auth = useAuth();
  const [name, setName] = useState(auth.user?.name ?? '');
  const [password, setPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
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
  return { backupCodes, setBackupCodes, auth, name, setName, password, setPassword, newPassword, setNewPassword, code, setCode, enrollment, setEnrollment, deleteEmail, setDeleteEmail, deleting, setDeleting, busy, message, error, setError, run, update, image, secret };
}
export function AccountDialog({ close, setup = false, onContinue }: { close: () => void; setup?: boolean; onContinue?: () => void }) {
  const { backupCodes, setBackupCodes, auth, name, setName, password, setPassword, newPassword, setNewPassword, code, setCode, enrollment, setEnrollment, deleteEmail, setDeleteEmail, deleting, setDeleting, busy, message, error, setError, run, update, image, secret } = useAccountControls();
  return <Modal setup={setup} backwards={setup} dismissible={!setup} title="Fiók" description={auth.user?.email} close={busy ? () => undefined : close} header={setup ? <SetupHeader step={0} disabled={busy} onStepChange={step => { if (step === 1) onContinue?.(); }} /> : undefined} footer={setup ? <Action icon={ArrowRight} disabled={busy} onPress={() => onContinue?.()}>Tovább a Profil lépéshez</Action> : undefined}>
    <View className="gap-3"><AccountImagePicker image={auth.user?.image} name={name} busy={busy} choose={() => void run(() => image(), 'Fiókkép mentve.')} receive={asset => void run(() => image(asset), 'Fiókkép mentve.')} reportError={setError} remove={() => void run(() => update({ imageKey: null }), 'Fiókkép törölve.')} /><Field label="Megjelenített név" value={name} onChange={setName} /><Action disabled={busy || (name.trim().length < 2 || name.trim().length > 50)} onPress={() => void run(() => update({ name: name.trim() }), 'Név mentve.')}>Név mentése</Action></View>
    <View className="gap-3 border-t border-border pt-4"><Text className="font-semibold">Jelszó és biztonság</Text><Input accessibilityLabel="Jelenlegi jelszó" placeholder="Jelenlegi jelszó" value={password} onChangeText={setPassword} secureTextEntry autoComplete="current-password" autoCapitalize="none" /><Input accessibilityLabel="Új jelszó" placeholder="Új jelszó (legalább 8 karakter)" value={newPassword} onChangeText={setNewPassword} secureTextEntry autoComplete="new-password" autoCapitalize="none" /><Action secondary disabled={busy || !password || newPassword.length < 8 || newPassword.length > 128} onPress={() => void run(async () => { await backend('/auth/change-password', 'POST', { currentPassword: password, newPassword, revokeOtherSessions: true }); setPassword(''); setNewPassword(''); }, 'Jelszó megváltoztatva. Más eszközök kijelentkeztetve.')}>Jelszó megváltoztatása</Action>
    <Text>{auth.user?.twoFactorEnabled ? 'Kétlépcsős hitelesítés bekapcsolva.' : 'Védd a fiókodat hitelesítő alkalmazással.'}</Text>
    {enrollment ? <><AuthenticatorQr uri={enrollment.totpURI} /><Text selectable>Hitelesítő kulcs: {secret}</Text><Text className="text-sm text-muted-foreground">Olvasd be a QR-kódot a hitelesítő alkalmazásban, vagy adj hozzá új fiókot ezzel a kulccsal. Mentsd el a helyreállítási kódokat biztonságos helyre: mindegyik egyszer használható.</Text><Text selectable>{enrollment.backupCodes.join('\n')}</Text><Input accessibilityLabel="Hatjegyű hitelesítési kód" placeholder="Hatjegyű hitelesítési kód" value={code} onChangeText={setCode} keyboardType="number-pad" autoComplete="one-time-code" /><Action disabled={busy || !/^\d{6}$/.test(code)} onPress={() => void run(async () => { await backend('/auth/two-factor/verify-totp', 'POST', { code }); await auth.refreshUser(); setEnrollment(null); setPassword(''); setCode(''); }, 'Kétlépcsős hitelesítés bekapcsolva.')}>Bekapcsolás megerősítése</Action></> : <Action secondary disabled={busy || !password} onPress={() => void run(async () => { if (auth.user?.twoFactorEnabled) { await backend('/auth/two-factor/disable', 'POST', { password }); await auth.refreshUser(); setPassword(''); } else setEnrollment(await backend('/auth/two-factor/enable', 'POST', { password, issuer: 'Triton42' })); }, auth.user?.twoFactorEnabled ? 'Kétlépcsős hitelesítés kikapcsolva.' : 'Add meg a hitelesítő alkalmazás kódját a befejezéshez.')}>{auth.user?.twoFactorEnabled ? 'Kétlépcsős hitelesítés kikapcsolása' : 'Kétlépcsős hitelesítés beállítása'}</Action>}
    {auth.user?.twoFactorEnabled && !enrollment ? <Action secondary disabled={busy || !password} onPress={() => void run(async () => { const result = await backend<{ backupCodes: string[] }>('/auth/two-factor/generate-backup-codes', 'POST', { password }); setBackupCodes(result.backupCodes); setPassword(''); }, 'Új helyreállítási kódok készültek. A korábbi kódok már nem érvényesek.')}>Új helyreállítási kódok</Action> : null}
    {backupCodes.length ? <><Text className="text-sm">Mentsd el ezeket a kódokat biztonságos helyre. Mindegyik egyszer használható.</Text><Text selectable>{backupCodes.join('\n')}</Text></> : null}
    </View>
    {error ? <Text accessibilityRole="alert" className="text-destructive">{error}</Text> : null}{message ? <Text accessibilityLiveRegion="polite">{message}</Text> : null}
    <AccountSettings disabled={busy} />
    <View className="gap-3 rounded-xl border border-destructive/40 p-4"><Text className="font-semibold text-destructive">Fiók törlése</Text><Text className="text-sm text-muted-foreground">Végleg törli a fiókot és a hozzá tartozó szerveren tárolt adatokat. Ez nem vonható vissza.</Text>{deleting ? <><Field label="Megerősítés: email-cím" value={deleteEmail} onChange={setDeleteEmail} /><Text className="text-sm">A törléshez a jelenlegi jelszót is add meg fent.</Text><Action secondary disabled={busy || !password || deleteEmail !== auth.user?.email} onPress={() => void run(async () => { const id = auth.user!.id; await backend('/auth/delete-user', 'POST', { password }); await auth.clearAccount(); await eraseAccountDatabase(id); }, '')}>Fiók végleges törlése</Action><Action secondary disabled={busy} onPress={() => setDeleting(false)}>Mégse</Action></> : <Action secondary disabled={busy} onPress={() => setDeleting(true)}>Fiók törlése…</Action>}</View>
  </Modal>;
}

/** The secret stays on this device; generating the QR never contacts an external service. */
function AuthenticatorQr({ uri }: { uri: string }) {
  const source = useMemo(() => { const code = createQrCode(0, 'M'); code.addData(uri); code.make(); return { uri: code.createDataURL(4, 16) }; }, [uri]);
  return <Image source={source} cachePolicy="none" accessibilityLabel="Hitelesítő alkalmazás QR-kódja" style={{ width: 240, height: 240, backgroundColor: '#ffffff', alignSelf: 'center' }} contentFit="contain" />;
}
