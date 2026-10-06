import { Injectable, ServiceUnavailableException } from '@nestjs/common'
import type { VirusScanResult } from '@fullstack-starter/shared'
import { Socket } from 'node:net'
import { Readable } from 'node:stream'

@Injectable()
export class VirusScannerService {
    private readonly host = process.env.VIRUS_SCANNER_HOST!
    private readonly port = Number(process.env.VIRUS_SCANNER_PORT)
    private readonly timeoutMs = Number(10000)

    scan(buffer: Buffer) {
        return this.scanStream(Readable.from([buffer]))
    }

    async ping(): Promise<void> {
        const response = await this.sendCommand('zPING\0')
        if (response !== 'PONG') {
            throw new ServiceUnavailableException(`Unexpected ClamAV ping response: ${response}`)
        }
    }

    async scanStream(stream: Readable): Promise<VirusScanResult> {
        const response = await this.sendInstream(stream)
        return this.parseScanResponse(response)
    }

    private async sendInstream(stream: Readable): Promise<string> {
        return new Promise((resolve, reject) => {
            const socket = new Socket()
            const chunks: Buffer[] = []
            let settled = false

            const cleanup = () => {
                socket.removeAllListeners()
                stream.removeAllListeners()
            }

            const finish = (err?: Error) => {
                if (settled) return
                settled = true

                cleanup()
                socket.destroy()

                if (err) return reject(err)

                resolve(Buffer.concat(chunks).toString('utf8').replace(/\0/g, '').trim())
            }

            socket.setTimeout(this.timeoutMs)
            socket.setNoDelay(true)

            socket.once('timeout', () => finish(new ServiceUnavailableException('ClamAV scan timed out')))

            socket.once('error', (err) => finish(new ServiceUnavailableException(`ClamAV unavailable: ${err.message}`)))

            socket.on('data', (chunk) => {
                chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk))
            })

            socket.once('end', () => finish())
            socket.once('close', () => {
                if (!settled) {
                    finish(new ServiceUnavailableException('ClamAV closed the connection without a response'))
                }
            })

            socket.connect(this.port, this.host, () => {
                socket.write('zINSTREAM\0')
                stream.resume()
            })

            stream.on('data', (chunk: Buffer | string) => {
                const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)

                const size = Buffer.alloc(4)
                size.writeUInt32BE(buffer.length, 0)

                const ok = socket.write(size)
                const ok2 = socket.write(buffer)

                if (!ok || !ok2) {
                    stream.pause()
                    socket.once('drain', () => stream.resume())
                }
            })

            stream.once('error', finish)

            stream.once('end', () => {
                socket.write(Buffer.alloc(4))
            })

            stream.pause()
        })
    }

    private async sendCommand(command: string): Promise<string> {
        return new Promise((resolve, reject) => {
            const socket = new Socket()
            const chunks: Buffer[] = []
            let settled = false

            const finish = (error?: Error) => {
                if (settled) return
                settled = true
                socket.removeAllListeners()
                socket.destroy()

                if (error) {
                    reject(error)
                    return
                }

                resolve(Buffer.concat(chunks).toString('utf8').replace(/\0/g, '').trim())
            }

            socket.setTimeout(this.timeoutMs)
            socket.once('timeout', () => finish(new ServiceUnavailableException('ClamAV command timed out')))
            socket.once('error', (error) =>
                finish(new ServiceUnavailableException(`ClamAV unavailable: ${error.message}`)),
            )
            socket.on('data', (chunk) => chunks.push(Buffer.from(chunk)))
            socket.once('end', () => finish())
            socket.once('close', () => {
                if (!settled) {
                    finish(new ServiceUnavailableException('ClamAV closed the connection without a response'))
                }
            })
            socket.connect(this.port, this.host, () => socket.write(command))
        })
    }

    private parseScanResponse(response: string): VirusScanResult {
        if (response.endsWith(' OK')) {
            return { status: 'clean', raw: response }
        }

        const foundMatch = response.match(/: (.+) FOUND$/)

        if (foundMatch) {
            return {
                status: 'infected',
                signature: foundMatch[1],
                raw: response,
            }
        }

        throw new ServiceUnavailableException(`Unexpected ClamAV response: ${response}`)
    }
}
