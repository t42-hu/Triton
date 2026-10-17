import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common'
import { statfs } from 'node:fs/promises'
@Injectable()
export class CalendarSubscriptionHealth implements OnModuleInit, OnModuleDestroy {
    private readonly logger = new Logger(CalendarSubscriptionHealth.name)
    private timer?: ReturnType<typeof setInterval>
    onModuleInit() {
        const check = () => {
            void this.check().catch(() => this.logger.warn('Unable to inspect worker filesystem capacity'))
        }
        this.timer = setInterval(check, 300000)
        this.timer.unref()
        check()
    }
    async check() {
        const fs = await statfs(process.env.TMPDIR || '/tmp')
        const free = fs.bavail * fs.bsize,
            capacity = fs.blocks * fs.bsize
        const used = 1 - free / capacity,
            inodes = fs.files ? 1 - fs.ffree / fs.files : 0
        if (used >= 0.85 || free < 2 * 1024 ** 3 || inodes >= 0.85)
            this.logger.error(
                { freeBytes: free, usedRatio: used, inodeUsedRatio: inodes },
                'Worker filesystem capacity is critical',
            )
        else if (used >= 0.75 || inodes >= 0.75)
            this.logger.warn(
                { freeBytes: free, usedRatio: used, inodeUsedRatio: inodes },
                'Worker filesystem capacity is low',
            )
    }
    onModuleDestroy() {
        if (this.timer) clearInterval(this.timer)
    }
}
