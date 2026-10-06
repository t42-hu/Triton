import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common'
import { Pool } from 'pg'
import { drizzle } from 'drizzle-orm/node-postgres'
import { runMigrations } from './migrations.js'
import * as schema from './database.schema.js'

@Injectable()
export class DatabaseService implements OnModuleInit, OnModuleDestroy {
    public readonly pool: Pool
    public readonly db

    constructor() {
        this.pool = new Pool({
            connectionString: process.env.DATABASE_URL,
            options: '-c search_path=public',
            connectionTimeoutMillis: 5000,
            query_timeout: 10000,
        })

        this.db = drizzle(this.pool, { schema })
    }

    async onModuleInit() {
        if (process.env.RUN_DATABASE_MIGRATIONS === 'true') await runMigrations(this.pool)
    }

    async onModuleDestroy() {
        await this.pool.end()
    }
}
