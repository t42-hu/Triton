import assert from 'node:assert/strict'
import test from 'node:test'
import nodemailer from 'nodemailer'
import { MailSchema } from '@fullstack-starter/shared'
import { renderEmailLoginEmail } from '../dist/mail/templates/email-login-email.js'

test('the logo survives mail validation and is embedded as an inline MIME image', async () => {
    const mail = MailSchema.parse({
        to: 'recipient@example.test',
        subject: 'Triton42',
        ...renderEmailLoginEmail('https://triton42.hu/api/auth/two-factor/email/approve?token=test'),
    })
    const image = mail.attachments[0]
    assert.ok(mail.html.includes(`src="cid:${image.cid}"`))
    assert.equal(Buffer.from(image.content, 'base64').subarray(0, 8).toString('hex'), '89504e470d0a1a0a')
    const result = await nodemailer.createTransport({ streamTransport: true, buffer: true }).sendMail({
        ...mail,
        from: 'noreply@example.test',
    })
    const mime = result.message.toString()
    assert.match(mime, /Content-Type: multipart\/related/)
    assert.match(mime, /Content-ID: <triton-logo@triton42.hu>/)
    assert.match(mime, /Content-Disposition: inline/)
    assert.match(mime, /Content-Type: image\/png/)
})

test('approval links remain escaped in HTML and intact in plain text', () => {
    const url = 'https://triton42.hu/api/auth/two-factor/email/approve?token=test&extra="value"'
    const mail = renderEmailLoginEmail(url)
    assert.ok(mail.text.includes(url))
    assert.ok(mail.html.includes('token=test&amp;extra=&quot;value&quot;'))
})

test('the account address is escaped and identifies the requested sign-in', () => {
    const email = 'name<&"@example.test'
    const mail = renderEmailLoginEmail('https://triton42.hu/approve?token=test', email)
    assert.ok(mail.text.includes(email))
    assert.ok(mail.html.includes('name&lt;&amp;&quot;@example.test'))
    assert.ok(!mail.html.includes(email))
    assert.ok(!renderEmailLoginEmail('https://triton42.hu/approve').html.includes('undefined'))
})
