# Authentication email design research

Researched 2026-10-17 for the Triton42 sign-in approval email. Primary sources only. The existing Triton42 flow is an approval link, single use, valid for 10 minutes, completing sign-in in the original application/browser. Research does not authorize changes to that flow.

## Observed email artifacts

### Dropbox: one-time sign-in security code

The [official help article](https://help.dropbox.com/account-access/one-time-code) publishes two actual email screenshots. The [simple variant](https://help.dropbox.com/account-access/one-time-code/_jcr_content/responsivegrid/responsivegrid_1821585867/c08_image_plank_401153027.coreimg.png/1742409188822/one-time-code-email-cropped-1.png) was downloaded and visually inspected. It shows a small centered blue Dropbox icon, then a left-aligned greeting, one short instruction, a bold code without a decorative code box, and a final short paragraph about an unrequested sign-in. White surface, dark ordinary body text, ample but economical spacing. No hero headline, illustration, nested cards or promotional footer.

This is an additional challenge for an unrecognized device/location. Do not describe the screenshot as proof of Dropbox's general 2FA email design. The [other official variant](https://help.dropbox.com/account-access/one-time-code/_jcr_content/responsivegrid/responsivegrid_1821585867/c08_image_plank.coreimg.png/1742409071454/one-time-security-code-correct-password-cropped-1.png) is explicitly associated with a password-reset action when the login was unrecognized; that action must not be copied without matching product behavior.

### Auth0 by Okta: email-address verification link

An [official Auth0 engineering article](https://auth0.com/blog/enforce-customer-email-verification-b2b-saas-blazor-app/) embeds the [default verification email screenshot](https://images.ctfassets.net/23aumh6u8s0i/6cP7skL9tqxBUnCAwC1cOa/0e31a5311fbd6506e75e010c091218a9/email-verification-message.png), downloaded and visually inspected. It uses a restrained monochrome logo, a descriptive heading, one compact black CTA, small muted supplementary text, and thin dividers. Unlike Dropbox, it has a rounded outer container and an account/link details panel. These panels are evidence of variety, not a requirement or a universal large-company pattern.

This is signup email-address verification, not second-factor approval and not a production sign-in email from every Auth0 customer. Useful detail: the action button is only as wide as its label and padding, and has modest corner rounding. Avoid copying its onboarding language or implying a support inbox exists.

## Flow and wording checks from other large companies

- [Slack's official sign-in help](https://slack.com/intl/en-gb/help/articles/212681477-sign-in-to-slack) describes email confirmation codes for signing in. This supports direct, functional terminology. It is documentation of a passwordless sign-in flow, not evidence for the visual appearance of Slack's emails.
- [GitHub's official device-verification documentation](https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/verifying-new-devices-when-signing-in) explicitly distinguishes emailed device verification from 2FA: device verification can occur when 2FA is **not** enabled. It describes a code entered back in the browser. No email screenshot was available in that source, so no visual claims are made.
- [Google's official security-alert help](https://support.google.com/accounts/answer/2590353?hl=en) describes alerts after important or suspicious actions, with device/time/location details. This is a security alert, not a generic approval template. Triton42 should not invent these metadata fields for visual credibility.
- [Notion's official login help](https://www.notion.com/en-gb/help/log-in-and-out) distinguishes email-code login from new-login alert emails. The latter can offer an action that ends a session. Do not transplant that action into Triton42's pending-approval email.

## Proposed Triton42 direction (design interpretation)

Borrow Dropbox's brevity and Auth0's compact CTA, retaining Triton42's own dark palette and icon/wordmark. These are our design choices, not claims that the companies use dark templates.

1. A quiet brand row; small icon, Triton text, pale-blue 42. No separate oversized header slab.
2. One clear title: **Bejelentkezés jóváhagyása**. No slogan, exclamation mark or persuasive headline.
3. One instruction: **A belépés folytatásához hagyd jóvá a bejelentkezést.**
4. A compact, left-aligned blue action button: **Jóváhagyom a belépést**. It should be the sole strong accent.
5. A plain paragraph: **A hivatkozás 10 percig érvényes, és egyszer használható. Jóváhagyás után térj vissza az alkalmazáshoz vagy a böngészőhöz, ahol elindítottad a belépést.**
6. A small safety paragraph, no card: **Ha nem te próbáltál belépni, ne hagyd jóvá a kérést. Ezt a levelet figyelmen kívül hagyhatod.**
7. Keep a copyable fallback URL subordinate, with line wrapping; never show a fake code, fabricated location/device, or a second competing CTA.

## Evidence limitations

Two first-party email artifacts were visually inspected. The other companies' sources verify authentication semantics, not visual layouts. Email variants, clients and time can change appearance. No claim of Gmail/Outlook compatibility or platform parity follows from this research; the implemented email still needs its own verification.

## Implemented design and validation

The final interpretation uses a small centered brand row above one compact dark surface. The approval title and recipient account address identify the request. A short instruction leads to a label-width CTA, followed by expiry and the return-to-original-app instruction. Safety guidance and a copyable, wrapping URL sit below the surface. Colors are Triton background #111317, surface #1c2025, border #3c434c, foreground #f0f2f5, muted #b6c0cb, primary #9eb7ed. Arial/Helvetica is used for dependable email-client fallback; 22px title, 15px instruction/button, 13–14px supporting text. Max width 480px, 24px mobile inner padding, 8px surface rounding and 4px button rounding.

Backend build and 11 email/auth tests passed. The rendered template was inspected in visible Safari Technology Preview on desktop and at a 320px viewport. The running backend's compiled template was confirmed updated. This is an email template change shared by web, Android and iOS authentication; no application UI bundle changed in this round. Gmail/Outlook rendering and native mail-client rendering have not been verified.
