import { createHash, randomBytes } from 'node:crypto'
import type { Pool } from 'pg'

export const EMAIL_LOGIN_SECONDS = 600
export const loginDigest = (value: string) => createHash('sha256').update(value).digest('hex')
export const loginSecret = () => randomBytes(32).toString('hex')
export type EmailLogin = { userId: string; tokenHash: string; approved: boolean; remember: boolean }
export interface EmailLoginStore {
    create(proof: string, token: string, userId: string, remember: boolean): Promise<void>
    approve(token: string): Promise<boolean>
    claim(proof: string): Promise<EmailLogin | 'pending' | null>
    cancel(proof: string): Promise<void>
}

/** Independent email and device secrets: neither one alone can issue a session. */
export class PostgresEmailLoginStore implements EmailLoginStore {
    constructor(private readonly pool: Pool) {}
    async create(proof: string, token: string, userId: string, remember: boolean) {
        await this.pool.query("DELETE FROM verification WHERE identifier LIKE 'email-login-%' AND expires_at <= now()")
        await this.pool.query(
            `INSERT INTO verification (id, identifier, value, expires_at, created_at, updated_at)
            VALUES ($1, $2, $3, now() + interval '10 minutes', now(), now())`,
            [
                loginSecret(),
                `email-login-${loginDigest(proof)}`,
                JSON.stringify({ userId, tokenHash: loginDigest(token), approved: false, remember }),
            ],
        )
    }
    async approve(token: string) {
        const [proofHash, secret] = token.split('.')
        if (
            !/^[a-f0-9]{64}$/.test(proofHash || '') ||
            !/^[a-f0-9]{64}$/.test(secret || '') ||
            token.split('.').length !== 2
        )
            return false
        const result = await this.pool.query(
            `UPDATE verification SET value = jsonb_set(value::jsonb, '{approved}', 'true')::text, updated_at = now()
            WHERE identifier = $1 AND expires_at > now() AND CASE WHEN identifier = $1 THEN value::jsonb->>'tokenHash' END = $2
            AND CASE WHEN identifier = $1 THEN value::jsonb->>'approved' END = 'false' RETURNING id`,
            [`email-login-${proofHash}`, loginDigest(secret)],
        )
        return result.rowCount === 1
    }
    async claim(proof: string): Promise<EmailLogin | 'pending' | null> {
        const identifier = `email-login-${loginDigest(proof)}`
        const result = await this.pool.query(
            `DELETE FROM verification WHERE identifier = $1 AND expires_at > now()
            AND CASE WHEN identifier = $1 THEN value::jsonb->>'approved' END = 'true' RETURNING value`,
            [identifier],
        )
        if (result.rows[0]) return JSON.parse(result.rows[0].value) as EmailLogin
        const pending = await this.pool.query(
            'SELECT id FROM verification WHERE identifier = $1 AND expires_at > now()',
            [identifier],
        )
        return pending.rowCount ? 'pending' : null
    }
    async cancel(proof: string) {
        await this.pool.query('DELETE FROM verification WHERE identifier = $1', [`email-login-${loginDigest(proof)}`])
    }
}
