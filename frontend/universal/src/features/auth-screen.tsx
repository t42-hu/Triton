import { backend } from '@/data/backend';
import { AuthCaptcha } from './auth-captcha';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, AppState, View } from 'react-native';
import { Clock3, LogIn, MailCheck, UserPlus } from 'lucide-react-native';
import { Input } from '@/components/ui/input';
import { PasswordInput } from '@/components/ui/password-input';
import { Label } from '@/components/ui/label';
import { Text } from '@/components/ui/text';
import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
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
  if (auth.twoFactorPending) return <EmailLoginPending />;
  return <SetupShell><Modal setup backwards={!register} title={register ? 'Regisztráció' : 'Bejelentkezés'} description={register ? 'Hozz létre fiókot, majd állítsd be a profilodat és importáld az órarended.' : undefined} dismissible={false} close={() => undefined} header={<SetupHeader step={0} accountLabel={register ? 'Regisztráció' : 'Belépés'} disabled />} footer={<View className="gap-3">{error || auth.error ? <Text accessibilityRole="alert" accessibilityLiveRegion="assertive" className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">{error || auth.error}</Text> : null}<Action icon={register ? UserPlus : LogIn} disabled={busy || captchaEnabled === null || (captchaEnabled && !captchaToken) || !email.trim() || !password} onPress={() => void submit()}>{busy ? 'Kapcsolódás…' : register ? 'Fiók létrehozása' : 'Bejelentkezés'}</Action><Button variant="link" disabled={busy} onPress={switchMode}><Text>{register ? 'Már van fiókom: Bejelentkezés' : 'Nincs még fiókom: Regisztráció'}</Text></Button></View>}>
    <View className="gap-2"><Label nativeID="auth-email">Email-cím</Label><Input accessibilityLabel="Email-cím" aria-labelledby="auth-email" value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" autoCorrect={false} autoComplete="email" editable={!busy} placeholder="nev@pelda.hu" /></View>
    <View className="gap-2"><Label nativeID="auth-password">Jelszó</Label><PasswordInput accessibilityLabel="Jelszó" aria-labelledby="auth-password" value={password} onChangeText={setPassword} autoCapitalize="none" autoCorrect={false} autoComplete={register ? 'new-password' : 'current-password'} editable={!busy} onSubmitEditing={() => void submit()} placeholder={register ? 'Legalább 8 karakter' : 'Jelszavad'} /></View>
    {captchaEnabled ? <AuthCaptcha siteKey={siteKey} onToken={setCaptchaToken} reset={reset} /> : null}
  </Modal></SetupShell>;
}
export function SessionLoading() { return <View className="flex-1 items-center justify-center bg-background"><ActivityIndicator /><Text className="mt-4 text-muted-foreground">Munkamenet ellenőrzése…</Text></View>; }

function EmailLoginPending() {
  const auth = useAuth();
  const [error, setError] = useState('');
  const [expired, setExpired] = useState(false);
  const [busy, setBusy] = useState(false);
  const polling = useRef(false);
  const authRef = useRef(auth);
  useEffect(() => { authRef.current = auth; }, [auth]);
  useEffect(() => {
    let active = true;
    async function check() {
      if (!active || polling.current) return;
      polling.current = true;
      try { await authRef.current.verifySecondFactor(); if (active) setError(''); }
      catch (error) { if (active) setError(error instanceof Error ? error.message : String(error)); }
      finally { polling.current = false; }
    }
    void check();
    function poll() { void check(); }
    function expire() { clearInterval(timer); setExpired(true); }
    function activated(state: string) { if (state === 'active') void check(); }
    const timer = setInterval(poll, 3000);
    const deadline = setTimeout(expire, 600000);
    const resume = AppState.addEventListener('change', activated);
    return () => { active = false; clearInterval(timer); clearTimeout(deadline); resume.remove(); };
  }, []);
  return <Modal title="Ellenőrizd az emailed" description="Elküldtük a belépés jóváhagyásához szükséges emailt." close={() => undefined} maxWidth={480} dismissible={false}>
    <View className="gap-4">
      <View className="flex-row items-start gap-3 rounded-xl bg-primary/5 p-4">
        <View className="h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10"><Icon as={MailCheck} size={20} className="text-primary" /></View>
        <View className="min-w-0 flex-1 gap-1"><Text className="font-semibold">Nyisd meg a jóváhagyó emailt</Text><Text className="text-sm leading-5 text-muted-foreground">Nyomd meg benne a „Bejelentkezés jóváhagyása” gombot. Ezután ezen az eszközön is befejeződik a belépés.</Text></View>
      </View>
      <View className="flex-row items-start gap-2"><Icon as={Clock3} size={16} className="mt-0.5 text-muted-foreground" /><Text className="min-w-0 flex-1 text-sm leading-5 text-muted-foreground">A hivatkozás egyszer használható, és 10 percig érvényes. Ha nem találod, nézd meg a spam mappát is.</Text></View>
      {!expired ? <View className="min-h-12 flex-row items-center gap-3 rounded-lg border border-border px-3"><ActivityIndicator size="small" /><Text accessibilityLiveRegion="polite" className="text-sm">Várakozás a jóváhagyásra…</Text></View> : <Text accessibilityRole="alert" className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive">A belépési hivatkozás lejárt. Indíts új belépést.</Text>}
      {error ? <Text accessibilityRole="alert" className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive">{error}</Text> : null}
      <Button variant="outline" className="w-full" disabled={busy} onPress={() => { setBusy(true); void auth.cancelSecondFactor().catch(error => { setError(error.message); setBusy(false); }); }}><Text>Vissza a bejelentkezéshez</Text></Button>
    </View>
  </Modal>;
}
