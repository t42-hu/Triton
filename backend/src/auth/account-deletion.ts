import { Logger } from '@nestjs/common'
import type { DatabaseService } from '../database/database.service.js'
import type { ProfileImageService } from '../profile-image/profile-image.service.js'
import type { StorageService } from '../storage/storage.service.js'

/** Capture file keys before cascading rows disappear; clean up only after deletion succeeds. */
export function accountDeletionHooks(db: DatabaseService, images?: ProfileImageService, storage?: StorageService) {
    const files = new WeakMap<Request, string[]>()
    const logger = new Logger('AccountDeletion')
    return {
        enabled: true,
        beforeDelete: async (user: { id: string }, request?: Request) => {
            if (!storage || !request) return
            const result = await db.pool.query<{ storage_key: string }>(
                `SELECT r.storage_key FROM calendar_source_revision r
                 JOIN calendar_source s ON s.id=r.source_id
                 JOIN calendar c ON c.id=s.calendar_id WHERE c.owner_user_id=$1
                 UNION
                 SELECT a.storage_key FROM event_attachment a
                 JOIN calendar_event e ON e.id=a.event_id
                 JOIN calendar c ON c.id=e.calendar_id
                 WHERE c.owner_user_id=$1 AND a.storage_key IS NOT NULL`,
                [user.id],
            )
            files.set(
                request,
                result.rows.map((row) => row.storage_key),
            )
        },
        afterDelete: async (user: { id: string; image?: string | null }, request?: Request) => {
            await images?.deleteByPublicUrl(user.image, user.id)
            const keys = request ? (files.get(request) ?? []) : []
            if (request) files.delete(request)
            const results = await Promise.allSettled(keys.map((key) => storage!.deleteObject(key)))
            if (results.some((result) => result.status === 'rejected')) logger.warn('Account file cleanup needs retry')
        },
    }
}
