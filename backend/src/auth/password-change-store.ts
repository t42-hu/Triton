import type { Pool } from 'pg'
import { loginDigest, loginSecret } from './email-login-store.js'

export type PendingPassword = {
    userId: string
    email: string
    accountId: string
    oldHash: string
    newHash: string
    sessionId: string
}
export interface PasswordChangeStore {
    create(token: string, change: PendingPassword): Promise<boolean>
    confirm(token: string): Promise<boolean>
    cancel(token: string): Promise<void>
}

export class PostgresPasswordChangeStore implements PasswordChangeStore {
    constructor(private readonly pool: Pool) {}
    async create(token: string, change: PendingPassword) {
        const db = await this.pool.connect()
        try {
            await db.query('BEGIN')
            const account = await db.query('SELECT password FROM account WHERE id = $1 AND user_id = $2 FOR UPDATE', [change.accountId, change.userId])
            if (account.rows[0]?.password !== change.oldHash) {
                await db.query('ROLLBACK')
                return false
            }
            await db.query(`DELETE FROM verification WHERE identifier LIKE 'password-change-%'
                AND (expires_at <= now() OR CASE WHEN identifier LIKE 'password-change-%' THEN value::jsonb->>'userId' END = $1)`, [change.userId])
            await db.query(`INSERT INTO verification (id, identifier, value, expires_at, created_at, updated_at)
                VALUES ($1, $2, $3, now() + interval '10 minutes', now(), now())`,
                [loginSecret(), `password-change-${loginDigest(token)}`, JSON.stringify(change)])
            await db.query('COMMIT')
            return true
        } catch (error) {
            await db.query('ROLLBACK')
            throw error
        } finally { db.release() }
    }
    async confirm(token: string) {
        if (!/^[a-f0-9]{64}$/.test(token)) return false
        const db = await this.pool.connect()
        try {
            await db.query('BEGIN')
            const identifier = `password-change-${loginDigest(token)}`
            // Read without a lock first; always lock account before challenges to avoid deadlocks with create().
            const found = await db.query('SELECT value FROM verification WHERE identifier = $1 AND expires_at > now()', [identifier])
            if (!found.rows[0]) { await db.query('ROLLBACK'); return false }
            const change = JSON.parse(found.rows[0].value) as PendingPassword
            const account = await db.query('SELECT password FROM account WHERE id = $1 AND user_id = $2 FOR UPDATE', [change.accountId, change.userId])
            const claimed = await db.query('DELETE FROM verification WHERE identifier = $1 AND expires_at > now() RETURNING id', [identifier])
            const user = await db.query('SELECT email FROM "user" WHERE id = $1 FOR UPDATE', [change.userId])
            if (claimed.rowCount !== 1 || account.rows[0]?.password !== change.oldHash || user.rows[0]?.email !== change.email) {
                await db.query('COMMIT')
                return false
            }
            await db.query('UPDATE account SET password = $1, updated_at = now() WHERE id = $2', [change.newHash, change.accountId])
            await db.query('DELETE FROM session WHERE user_id = $1 AND id <> $2', [change.userId, change.sessionId])
            await db.query(`DELETE FROM verification WHERE (identifier LIKE 'password-change-%' OR identifier LIKE 'email-login-%')
                AND CASE WHEN identifier LIKE 'password-change-%' OR identifier LIKE 'email-login-%' THEN value::jsonb->>'userId' END = $1`, [change.userId])
            await db.query('COMMIT')
            return true
        } catch (error) {
            await db.query('ROLLBACK')
            throw error
        } finally { db.release() }
    }
    async cancel(token: string) {
        await this.pool.query('DELETE FROM verification WHERE identifier = $1', [`password-change-${loginDigest(token)}`])
    }
}
