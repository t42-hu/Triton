import { backend } from '@/data/backend';
import { AuthCaptcha } from './auth-captcha';
import { useEffect, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { LogIn, UserPlus } from 'lucide-react-native';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Text } from '@/components/ui/text';
import { Button } from '@/components/ui/button';
import { useAuth } from './auth-state';
import { SetupShell } from './setup-shell';
import { SetupHeader } from './setup-header';
import { Action, Modal } from './controls';
export function AuthScreen() {
  const auth = useAuth();
  const [captchaEnabled, setCaptchaEnabled] = useState<boolean | null>(null);
  const [siteKey, setSiteKey] = useState<string | null>(null);
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  const [reset, setReset] = useState(0);
  const [code, setCode] = useState('');
  const [backup, setBackup] = useState(false);
  const [register, setRegister] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => {
    async function configure() {
      try {
        const config = await backend<{ captcha?: { enabled: boolean; siteKey?: string | null } }>('/config');
        setSiteKey(config.captcha?.siteKey ?? null); setCaptchaEnabled(Boolean(config.captcha?.enabled));
        if (config.captcha?.enabled && !config.captcha.siteKey) setError('A biztonsági ellenőrzés nincs beállítva a szerveren.');
      } catch (error) { setError(error instanceof Error ? error.message : String(error)); }
    }
    void configure();
  }, []);
  async function submit() {
    if (busy || captchaEnabled === null || (captchaEnabled && !captchaToken)) return;
    setBusy(true); setError('');
    try { await auth.authenticate(email, password, register, captchaToken ?? undefined); }
    catch (error) { setError(error instanceof Error ? error.message : String(error)); }
    finally { setPassword(''); setBusy(false); setCaptchaToken(null); setReset(value => value + 1); }
  }
  function switchMode() { setRegister(value => !value); setPassword(''); setError(''); setCaptchaToken(null); setReset(value => value + 1); }
  if (auth.twoFactorPending) return <SetupShell><Modal setup title="Kétlépcsős bejelentkezés" description={backup ? 'Add meg az egyik egyszer használatos helyreállítási kódot.' : 'Add meg a hitelesítő alkalmazásban látható hatjegyű kódot.'} close={() => undefined} dismissible={false}><View className="gap-2"><Label nativeID="auth-code">{backup ? 'Helyreállítási kód' : 'Hitelesítési kód'}</Label><Input aria-labelledby="auth-code" accessibilityLabel={backup ? 'Helyreállítási kód' : 'Hitelesítési kód'} value={code} onChangeText={setCode} autoCapitalize="none" keyboardType={backup ? 'default' : 'number-pad'} autoComplete="one-time-code" /></View><Action disabled={busy || !code.trim()} onPress={() => { setBusy(true); setError(''); void auth.verifySecondFactor(code, backup).catch(error => setError(error.message)).finally(() => setBusy(false)); }}>Kód ellenőrzése</Action><Button variant="ghost" disabled={busy} onPress={() => { setBackup(value => !value); setCode(''); setError(''); }}><Text>{backup ? 'Hitelesítő alkalmazás használata' : 'Helyreállítási kód használata'}</Text></Button><Button variant="ghost" disabled={busy} onPress={() => { auth.cancelSecondFactor(); setCode(''); setError(''); }}><Text>Vissza a bejelentkezéshez</Text></Button>{error ? <Text accessibilityRole="alert" className="text-destructive">{error}</Text> : null}</Modal></SetupShell>;
  return <SetupShell><Modal setup backwards={!register} title={register ? 'Regisztráció' : 'Bejelentkezés'} description={register ? 'Hozz létre fiókot, majd állítsd be a profilodat és importáld az órarended.' : undefined} dismissible={false} close={() => undefined} header={<SetupHeader step={0} accountLabel={register ? 'Regisztráció' : 'Belépés'} disabled />} footer={<View className="gap-3">{error || auth.error ? <Text accessibilityRole="alert" accessibilityLiveRegion="assertive" className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">{error || auth.error}</Text> : null}<Action icon={register ? UserPlus : LogIn} disabled={busy || captchaEnabled === null || (captchaEnabled && !captchaToken) || !email.trim() || !password} onPress={() => void submit()}>{busy ? 'Kapcsolódás…' : register ? 'Fiók létrehozása' : 'Bejelentkezés'}</Action><Button variant="link" disabled={busy} onPress={switchMode}><Text>{register ? 'Már van fiókom: Bejelentkezés' : 'Nincs még fiókom: Regisztráció'}</Text></Button></View>}>
    <View className="gap-2"><Label nativeID="auth-email">Email-cím</Label><Input accessibilityLabel="Email-cím" aria-labelledby="auth-email" value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" autoCorrect={false} autoComplete="email" editable={!busy} placeholder="nev@pelda.hu" /></View>
    <View className="gap-2"><Label nativeID="auth-password">Jelszó</Label><Input accessibilityLabel="Jelszó" aria-labelledby="auth-password" value={password} onChangeText={setPassword} secureTextEntry autoCapitalize="none" autoCorrect={false} autoComplete={register ? 'new-password' : 'current-password'} editable={!busy} onSubmitEditing={() => void submit()} placeholder={register ? 'Legalább 8 karakter' : 'Jelszavad'} /></View>
    {captchaEnabled ? <AuthCaptcha siteKey={siteKey} onToken={setCaptchaToken} reset={reset} /> : null}
  </Modal></SetupShell>;
}
export function SessionLoading() { return <View className="flex-1 items-center justify-center bg-background"><ActivityIndicator /><Text className="mt-4 text-muted-foreground">Munkamenet ellenőrzése…</Text></View>; }
