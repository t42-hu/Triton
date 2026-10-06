import nodemailer from 'nodemailer'
import { Injectable, ServiceUnavailableException } from '@nestjs/common'
import { SendEmailCommand, SESv2Client } from '@aws-sdk/client-sesv2'
import type { Destination } from '@aws-sdk/client-sesv2'
import { MailSchema, type Mail } from '@fullstack-starter/shared'
import { PinoLogger } from 'nestjs-pino'

const normalizeAddresses = (addresses?: string | string[]) => {
    if (!addresses) {
        return undefined
    }

    const values = Array.isArray(addresses) ? addresses : addresses.split(',')
    const normalized = values.map((address) => address.trim()).filter(Boolean)

    return normalized.length > 0 ? normalized : undefined
}

@Injectable()
export class MailService {
    private readonly client = new SESv2Client({
        region: process.env.AWS_REGION || process.env.AWS_DEFAULT_REGION,
    })

    constructor(private readonly logger: PinoLogger) {
        this.logger.setContext(MailService.name)
    }

    async send(body: Mail) {
        const provider = process.env.MAIL_PROVIDER || 'disabled'
        if (provider === 'disabled') throw new ServiceUnavailableException('Email is disabled')
        const mail = MailSchema.parse(body)
        const toAddresses = normalizeAddresses(mail.to)

        if (!toAddresses) {
            throw new Error('Mail recipient is required.')
        }

        const fromAddress = mail.from || process.env.MAIL_FROM

        if (!fromAddress) {
            throw new Error('Missing sender address.')
        }

        if (provider === 'smtp') {
            const transport = nodemailer.createTransport({
                host: process.env.SMTP_HOST,
                port: Number(process.env.SMTP_PORT || 1025),
                secure: process.env.SMTP_SECURE === 'true',
                ...(process.env.SMTP_USER
                    ? {
                          auth: {
                              user: process.env.SMTP_USER,
                              pass: process.env.SMTP_PASSWORD,
                          },
                      }
                    : {}),
                connectionTimeout: 5000,
                socketTimeout: 10000,
            })
            return transport.sendMail({ ...mail, from: fromAddress })
        }

        const destination: Destination = {
            ToAddresses: toAddresses,
            CcAddresses: normalizeAddresses(mail.cc),
            BccAddresses: normalizeAddresses(mail.bcc),
        }

        try {
            return await this.client.send(
                new SendEmailCommand({
                    FromEmailAddress: fromAddress,
                    Destination: destination,
                    ReplyToAddresses: normalizeAddresses(mail.replyTo),
                    ConfigurationSetName: process.env.SES_CONFIGURATION_SET || undefined,
                    Content: {
                        Simple: {
                            Subject: {
                                Data: mail.subject,
                                Charset: 'UTF-8',
                            },
                            Body: {
                                ...(mail.html
                                    ? {
                                          Html: {
                                              Data: mail.html,
                                              Charset: 'UTF-8',
                                          },
                                      }
                                    : {}),
                                ...(mail.text
                                    ? {
                                          Text: {
                                              Data: mail.text,
                                              Charset: 'UTF-8',
                                          },
                                      }
                                    : {}),
                            },
                        },
                    },
                }),
            )
        } catch (error) {
            this.logger.error({ err: error, provider: 'ses' }, 'Email send failed')
            throw error
        }
    }
}
