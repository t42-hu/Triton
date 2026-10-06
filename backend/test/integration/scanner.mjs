import 'reflect-metadata'
import assert from 'node:assert/strict'
import { VirusScannerService } from '../../dist/virusscanner/virusscanner.service.js'
import { ProfileImageService } from '../../dist/profile-image/profile-image.service.js'
assert.ok(process.env.TEST_SCANNER_PORT, 'Set TEST_SCANNER_PORT for isolated ClamAV')
process.env.VIRUS_SCANNER_HOST = '127.0.0.1'
process.env.VIRUS_SCANNER_PORT = process.env.TEST_SCANNER_PORT
process.env.VIRUS_SCAN_ENABLED = 'true'
const scanner = new VirusScannerService()
await scanner.ping()
assert.equal((await scanner.scan(Buffer.from('clean text'))).status, 'clean')
const eicar = Buffer.from('X5O!P%@AP[4\\PZX54(P^)7CC)7}$EICAR-STANDARD-ANTIVIRUS-TEST-FILE!$H+H*')
assert.equal((await scanner.scan(eicar)).status, 'infected')
let stored = false
const storage = {
    putObject: async () => {
        stored = true
    },
}
const uploads = new ProfileImageService(storage, scanner)
await assert.rejects(
    () =>
        uploads.optimizeAndUpload('test-user', {
            mimetype: 'image/png',
            buffer: eicar,
        }),
    /unsafe/,
)
assert.equal(stored, false)
process.env.VIRUS_SCANNER_PORT = '1'
const unavailable = new ProfileImageService(storage, new VirusScannerService())
await assert.rejects(
    () =>
        unavailable.optimizeAndUpload('test-user', {
            mimetype: 'image/png',
            buffer: eicar,
        }),
    /unavailable/,
)
assert.equal(stored, false)
console.log('PASS real ClamAV clean scan, EICAR detection, and upload rejection before storage')
console.log('PASS required scanner fails closed when unavailable')
