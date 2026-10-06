import type { INestApplicationContext } from '@nestjs/common'
import { IoAdapter } from '@nestjs/platform-socket.io'
import { createAdapter } from '@socket.io/redis-adapter'
import { createClient } from 'redis'

export class RedisIoAdapter extends IoAdapter {
    private adapterConstructor?: ReturnType<typeof createAdapter>
    private pubClient?: ReturnType<typeof createClient>
    private subClient?: ReturnType<typeof createClient>

    constructor(
        app: INestApplicationContext,
        private readonly redisUrl: string,
    ) {
        super(app)
    }

    async connectToRedis() {
        const pubClient = createClient({ url: this.redisUrl })
        const subClient = pubClient.duplicate()

        await Promise.all([pubClient.connect(), subClient.connect()])
        this.pubClient = pubClient
        this.subClient = subClient
        this.adapterConstructor = createAdapter(pubClient, subClient)
    }

    createIOServer(port: number) {
        const server = super.createIOServer(port)

        if (this.adapterConstructor) {
            server.adapter(this.adapterConstructor)
        }

        return server
    }

    async dispose() {
        await Promise.all(
            [this.pubClient, this.subClient].filter((client) => client?.isOpen).map((client) => client!.quit()),
        )
        await super.dispose()
    }
}
