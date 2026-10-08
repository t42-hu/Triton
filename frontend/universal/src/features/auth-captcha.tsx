import { WebView } from 'react-native-webview';
import { useEffect } from 'react';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { NAV_THEME } from '@/lib/theme';
export function AuthCaptcha({ onToken, reset }: { siteKey: string | null; onToken: (token: string | null) => void; reset: number }) {
  const theme = useColorScheme();
  // Cloudflare requires a real hosted origin in mobile WebViews.
  const url = new URL(process.env.EXPO_PUBLIC_CAPTCHA_URL || 'https://mobile.triton42.hu/captcha/triton');
  url.searchParams.set('attempt', String(reset)); url.searchParams.set('theme', theme);
  useEffect(() => onToken(null), [theme, reset, onToken]);
  return <WebView key={`${reset}:${theme}`} source={{ uri: url.toString() }} originWhitelist={[url.origin, 'https://challenges.cloudflare.com', 'about:blank', 'about:srcdoc']} onShouldStartLoadWithRequest={request => request.url.startsWith(`${url.origin}/`) || request.url.startsWith('https://challenges.cloudflare.com/') || ['about:blank', 'about:srcdoc'].includes(request.url)} containerStyle={{ height: 90, flex: 0 }} style={{ backgroundColor: NAV_THEME[theme].colors.card }} javaScriptEnabled domStorageEnabled onMessage={event => { try { const message = JSON.parse(event.nativeEvent.data); if (message.type === 'triton-captcha') onToken(typeof message.token === 'string' ? message.token : null); } catch { onToken(null); } }} />;
}
