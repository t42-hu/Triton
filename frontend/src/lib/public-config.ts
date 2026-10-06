'use client'

import { parseApiResponse } from '@/lib/api/api-helper'
import { getPublicConfig } from '@/lib/api/generated/client'
import { useEffect, useState } from 'react'
import { PublicConfigSchema, type PublicConfig } from '@fullstack-starter/shared'

export function usePublicConfig() {
    const [config, setConfig] = useState<PublicConfig | null>(null)
    useEffect(() => {
        const controller = new AbortController()
        void getPublicConfig({ signal: controller.signal })
            .then((value) => setConfig(parseApiResponse(value, PublicConfigSchema)))
            .catch(() => undefined)
        return () => controller.abort()
    }, [])
    return config
}
