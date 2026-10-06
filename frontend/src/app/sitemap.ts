import type { MetadataRoute } from 'next'

import { siteUrl } from '@/lib/constants'

export const dynamic = 'force-static'

export default function sitemap(): MetadataRoute.Sitemap {
    const lastModified = new Date()

    return [
        {
            url: siteUrl,
            lastModified,
            changeFrequency: 'weekly',
            priority: 1,
        },
    ]
}
