import { useEffect, useRef } from 'react';
import { useColorScheme } from '@/hooks/use-color-scheme';
type Turnstile = { render: (element: HTMLElement, options: Record<string, unknown>) => string; remove: (id: string) => void };
export function AuthCaptcha({ siteKey, onToken, reset }: { siteKey: string | null; onToken: (token: string | null) => void; reset: number }) {
  const container = useRef<HTMLDivElement>(null);
  const theme = useColorScheme();
  useEffect(() => {
    if (!siteKey) return;
    onToken(null);
    let disposed = false; let id: string | null = null;
    const api = () => (window as unknown as { turnstile?: Turnstile }).turnstile;
    function render() { if (disposed || id || !container.current || !api()) return; id = api()!.render(container.current, { sitekey: siteKey, theme, callback: onToken, 'error-callback': () => onToken(null), 'expired-callback': () => onToken(null) }); }
    let script = document.getElementById('triton-turnstile') as HTMLScriptElement | null;
    if (!script) { script = document.createElement('script'); script.id = 'triton-turnstile'; script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit'; script.async = true; document.head.append(script); }
    script.addEventListener('load', render); render();
    return () => { disposed = true; script?.removeEventListener('load', render); if (id) api()?.remove(id); };
  }, [siteKey, reset, onToken, theme]);
  return <div ref={container} aria-label="Cloudflare biztonsági ellenőrzés" style={{ minHeight: 70, display: 'flex', justifyContent: 'center', colorScheme: theme }} />;
}
