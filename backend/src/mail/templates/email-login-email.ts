import { tritonEmailLogo } from './triton-email-logo.js'

const escapeHtml = (value: string) => value
    .replaceAll('&', '&amp;')
    .replaceAll('"', '&quot;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')

/** Table layout, inline styles and an embedded logo for email clients. */
export function renderEmailLoginEmail(approvalUrl: string, recipientEmail?: string) {
    const href = escapeHtml(approvalUrl)
    const account = recipientEmail ? `<p style="margin:8px 0 0;color:#b6c0cb;font-size:14px;line-height:22px;overflow-wrap:anywhere;word-break:break-word;">${escapeHtml(recipientEmail)}</p>` : ''
    return {
        attachments: [
            {
                filename: 'triton-logo.png',
                content: tritonEmailLogo,
                encoding: 'base64' as const,
                contentType: 'image/png',
                cid: 'triton-logo@triton42.hu',
                contentDisposition: 'inline' as const,
            },
        ],
        text: `Triton42 – Bejelentkezés jóváhagyása${recipientEmail ? `\n${recipientEmail}` : ''}\n\nA belépés folytatásához hagyd jóvá a bejelentkezést:\n${approvalUrl}\n\nA hivatkozás 10 percig érvényes, és egyszer használható.\n\nJóváhagyás után térj vissza az alkalmazáshoz vagy a böngészőhöz, ahol elindítottad a belépést.\n\nHa nem te próbáltál belépni, ne hagyd jóvá a kérést. Ezt a levelet figyelmen kívül hagyhatod.`,
        html: `<!doctype html>
<html lang="hu">
<head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="dark"><meta name="supported-color-schemes" content="dark">
<title>Triton42 – Bejelentkezés jóváhagyása</title>
<style>
@media (max-width: 480px) { .outer { padding: 28px 16px !important; } .content { padding: 28px 24px !important; } }
a:focus-visible { outline: 2px solid #f0f2f5; outline-offset: 4px; }
</style>
</head>
<body bgcolor="#111317" style="margin:0;padding:0;background-color:#111317;font-family:Arial,Helvetica,sans-serif;-webkit-text-size-adjust:100%;">
<div style="display:none;font-size:1px;color:#111317;line-height:1px;max-height:0;max-width:0;opacity:0;overflow:hidden;mso-hide:all;">Hagyd jóvá a bejelentkezést a Triton42-fiókodba. A hivatkozás 10 percig érvényes.</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#111317"><tr><td class="outer" align="center" style="padding:40px 24px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:480px;">
<tr><td align="center" style="padding-bottom:24px;">
<table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr><td width="28" valign="middle"><img src="cid:triton-logo@triton42.hu" width="28" height="28" alt="" style="display:block;border:0;"></td><td valign="middle" style="padding-left:8px;color:#f0f2f5;font-size:22px;line-height:28px;font-weight:700;letter-spacing:-0.7px;">Triton<span style="color:#9eb7ed;">42</span></td></tr></table>
</td></tr>
<tr><td class="content" bgcolor="#1c2025" style="padding:32px;background-color:#1c2025;border:1px solid #3c434c;border-radius:8px;">
<h1 style="margin:0;color:#f0f2f5;font-size:22px;line-height:29px;font-weight:600;letter-spacing:-0.4px;">Bejelentkezés jóváhagyása</h1>
${account}
<p style="margin:24px 0;color:#f0f2f5;font-size:15px;line-height:24px;">A belépés folytatásához hagyd jóvá a bejelentkezést.</p>
<table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr><td align="center" bgcolor="#9eb7ed" style="border-radius:4px;mso-padding-alt:11px 18px;"><a href="${href}" target="_blank" style="display:inline-block;padding:11px 18px;border:1px solid #9eb7ed;border-radius:4px;background-color:#9eb7ed;color:#111b31;font-size:15px;line-height:22px;font-weight:700;text-decoration:none;">Bejelentkezés jóváhagyása</a></td></tr></table>
<p style="margin:12px 0 24px;color:#b6c0cb;font-size:13px;line-height:20px;">10 percig érvényes, egyszer használható.</p>
<p style="margin:0;color:#b6c0cb;font-size:14px;line-height:22px;">Jóváhagyás után térj vissza az alkalmazáshoz vagy a böngészőhöz, ahol elindítottad a belépést.</p>
</td></tr>
<tr><td style="padding:20px 8px 0;">
<p style="margin:0;color:#b6c0cb;font-size:13px;line-height:21px;">Ha nem te próbáltál belépni, ne hagyd jóvá a kérést. Ezt a levelet figyelmen kívül hagyhatod.</p>
<p style="margin:16px 0 0;color:#b6c0cb;font-size:12px;line-height:19px;">Ha a gomb nem működik, másold a böngésződbe ezt a hivatkozást:</p>
<p style="margin:4px 0 0;font-size:12px;line-height:19px;overflow-wrap:anywhere;word-break:break-all;"><a href="${href}" style="color:#9eb7ed;text-decoration:underline;word-break:break-all;">${href}</a></p>
</td></tr>
</table>
</td></tr></table>
</body></html>`,
    }
}
