export type VirusScanStatus = 'clean' | 'infected'

export type VirusScanResult = {
    status: VirusScanStatus
    signature?: string
    raw: string
}
