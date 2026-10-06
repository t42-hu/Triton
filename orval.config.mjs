export default {
    application: {
        input: { target: './openapi.json' },
        output: {
            mode: 'single',
            target: './frontend/src/lib/api/generated/client.ts',
            schemas: './frontend/src/lib/api/generated/models',
            client: 'fetch',
            override: {
                fetch: {
                    includeHttpResponseReturnType: false,
                    forceSuccessResponse: true,
                },
                mutator: {
                    path: './frontend/src/lib/api/generated-mutator.ts',
                    name: 'generatedApiRequest',
                },
            },
        },
    },
}
