import { Injectable, ServiceUnavailableException } from '@nestjs/common'
import { Meilisearch } from 'meilisearch'

@Injectable()
export class SearchService {
    private client?: Meilisearch

    getClient(): Meilisearch {
        if (process.env.SEARCH_ENABLED !== 'true') throw new ServiceUnavailableException('Search is disabled')
        this.client ??= new Meilisearch({
            host: process.env.SEARCH_ENGINE_URL!,
            apiKey: process.env.SEARCH_ENGINE_MASTER_KEY,
        })
        return this.client
    }

    getIndex<T extends Record<string, unknown>>(indexUid: string) {
        return this.getClient().index<T>(indexUid)
    }

    health() {
        return this.getClient().health()
    }
}
