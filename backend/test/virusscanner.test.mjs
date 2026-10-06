import assert from 'node:assert/strict'
import { createServer } from 'node:net'
import test from 'node:test'
import { VirusScannerService } from '../dist/virusscanner/virusscanner.service.js'

async function startMockClamServer(onConnection) {
    const server = createServer(onConnection)
    await new Promise((resolve, reject) => {
        server.once('error', reject)
        server.listen(0, '127.0.0.1', resolve)
    })

    const address = server.address()
    assert.ok(address && typeof address === 'object')

    return {
        port: address.port,
        close: () => new Promise((resolve, reject) => server.close((error) => (error ? reject(error) : resolve()))),
    }
}

test('sends the ClamAV INSTREAM command before file chunks', async () => {
    const receivedChunks = []
    const mock = await startMockClamServer((socket) => {
        let buffer = Buffer.alloc(0)
        let commandReceived = false

        socket.on('data', (chunk) => {
            buffer = Buffer.concat([buffer, chunk])

            if (!commandReceived) {
                const commandEnd = buffer.indexOf(0)
                if (commandEnd === -1) return
                assert.equal(buffer.subarray(0, commandEnd).toString(), 'zINSTREAM')
                buffer = buffer.subarray(commandEnd + 1)
                commandReceived = true
            }

            while (buffer.length >= 4) {
                const size = buffer.readUInt32BE(0)
                if (size === 0) {
                    buffer = buffer.subarray(4)
                    socket.end('stream: OK\0')
                    return
                }
                if (buffer.length < size + 4) return
                receivedChunks.push(buffer.subarray(4, size + 4))
                buffer = buffer.subarray(size + 4)
            }
        })
    })

    process.env.VIRUS_SCANNER_HOST = '127.0.0.1'
    process.env.VIRUS_SCANNER_PORT = String(mock.port)

    try {
        const result = await new VirusScannerService().scan(Buffer.from('safe upload'))
        assert.equal(result.status, 'clean')
        assert.equal(Buffer.concat(receivedChunks).toString(), 'safe upload')
    } finally {
        await mock.close()
    }
})

test('validates the ClamAV ping response', async () => {
    const mock = await startMockClamServer((socket) => {
        socket.once('data', (chunk) => {
            assert.equal(chunk.toString(), 'zPING\0')
            socket.end('PONG\0')
        })
    })

    process.env.VIRUS_SCANNER_HOST = '127.0.0.1'
    process.env.VIRUS_SCANNER_PORT = String(mock.port)

    try {
        await new VirusScannerService().ping()
    } finally {
        await mock.close()
    }
})
