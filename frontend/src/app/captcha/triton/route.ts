/** A small hosted document for native Turnstile, independent of web app hydration. */
export async function GET(request: Request) {
    const dark = new URL(request.url).searchParams.get('theme') === 'dark'
    const background = dark ? '#1B1E23' : '#FFFFFF'
    const foreground = dark ? '#B8C1CC' : '#1F2937'
    const headers = { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' }
    try {
        const api = (process.env.BACKEND_INTERNAL_URL || 'http://localhost:4000').replace(/\/$/, '')
        const response = await fetch(`${api}/api/config`, { cache: 'no-store', signal: AbortSignal.timeout(10000) })
        if (!response.ok) throw new Error('Configuration unavailable')
        const config = await response.json()
        if (typeof config.captcha?.siteKey !== 'string' || !config.captcha.siteKey.trim())
            throw new Error('CAPTCHA key unavailable')
        const key = JSON.stringify(config.captcha.siteKey).replaceAll('<', '\\u003c')
        return new Response(
            `<!doctype html><html lang="hu"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Biztonsági ellenőrzés</title><style>html,body{margin:0;background:${background};color:${foreground};font:14px system-ui}body{display:flex;justify-content:center;padding:8px;box-sizing:border-box}#status{margin:12px 0}</style></head><body><div id="captcha"><p id="status" role="status">Betöltés…</p></div><script>
function notify(token){var message={type:'triton-captcha',token:token};window.parent.postMessage(message,window.location.origin);if(window.ReactNativeWebView)window.ReactNativeWebView.postMessage(JSON.stringify(message));}
function ready(){document.getElementById('status').remove();window.turnstile.render('#captcha',{sitekey:${key},theme:'${dark ? 'dark' : 'light'}',callback:notify,'expired-callback':function(){notify(null)},'error-callback':function(){notify(null)}});}
</script><script src="https://challenges.cloudflare.com/turnstile/v0/api.js?onload=ready&render=explicit" async defer></script></body></html>`,
            { headers },
        )
    } catch {
        return new Response(
            `<!doctype html><html lang="hu"><meta name="viewport" content="width=device-width,initial-scale=1"><body style="margin:8px;background:${background};color:${foreground};font:14px system-ui"><p role="alert">A biztonsági ellenőrzés nem tölthető be.</p></body></html>`,
            { status: 503, headers },
        )
    }
}
