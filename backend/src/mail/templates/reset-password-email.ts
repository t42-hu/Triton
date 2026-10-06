import { Body, Button, Container, Head, Heading, Hr, Html, Preview, Section, Text } from '@react-email/components'
import { render } from '@react-email/render'
import React from 'react'

type ResetPasswordEmailProps = {
    appName: string
    resetUrl: string
    userName?: string | null
}

const brandColor = '#16a34a'

function ResetPasswordEmail({ appName, resetUrl, userName }: ResetPasswordEmailProps) {
    const greeting = userName ? `Hi ${userName},` : 'Hi,'

    return React.createElement(
        Html,
        null,
        React.createElement(Head),
        React.createElement(Preview, null, `Reset your ${appName} password`),
        React.createElement(
            Body,
            {
                style: {
                    margin: 0,
                    backgroundColor: '#f8fafc',
                    fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
                },
            },
            React.createElement(
                Container,
                {
                    style: {
                        margin: '0 auto',
                        maxWidth: '560px',
                        padding: '40px 20px',
                    },
                },
                React.createElement(
                    Section,
                    {
                        style: {
                            backgroundColor: '#ffffff',
                            border: '1px solid #e2e8f0',
                            borderRadius: '8px',
                            padding: '32px',
                        },
                    },
                    React.createElement(
                        Heading,
                        {
                            style: {
                                color: '#0f172a',
                                fontSize: '24px',
                                lineHeight: '32px',
                                margin: '0 0 20px',
                            },
                        },
                        'Reset your password',
                    ),
                    React.createElement(
                        Text,
                        {
                            style: {
                                color: '#334155',
                                fontSize: '16px',
                                lineHeight: '24px',
                                margin: '0 0 16px',
                            },
                        },
                        greeting,
                    ),
                    React.createElement(
                        Text,
                        {
                            style: {
                                color: '#334155',
                                fontSize: '16px',
                                lineHeight: '24px',
                                margin: '0 0 24px',
                            },
                        },
                        `Use the button below to choose a new password for your ${appName} account.`,
                    ),
                    React.createElement(
                        Button,
                        {
                            href: resetUrl,
                            style: {
                                backgroundColor: brandColor,
                                borderRadius: '6px',
                                color: '#ffffff',
                                display: 'inline-block',
                                fontSize: '15px',
                                fontWeight: 700,
                                padding: '12px 18px',
                                textDecoration: 'none',
                            },
                        },
                        'Reset password',
                    ),
                    React.createElement(Hr, {
                        style: {
                            borderColor: '#e2e8f0',
                            margin: '28px 0',
                        },
                    }),
                    React.createElement(
                        Text,
                        {
                            style: {
                                color: '#64748b',
                                fontSize: '14px',
                                lineHeight: '22px',
                                margin: 0,
                            },
                        },
                        'If you did not request this password reset, you can ignore this email.',
                    ),
                ),
            ),
        ),
    )
}

export async function renderResetPasswordEmail(props: ResetPasswordEmailProps) {
    const email = React.createElement(ResetPasswordEmail, props)

    return {
        html: await render(email),
        text: await render(email, { plainText: true }),
    }
}
