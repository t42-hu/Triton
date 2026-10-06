import js from '@eslint/js'
import globals from 'globals'
import tseslint from 'typescript-eslint'
import next from '@next/eslint-plugin-next'
import hooks from 'eslint-plugin-react-hooks'

export default tseslint.config(
    {
        ignores: [
            '**/node_modules/**',
            'frontend/universal/**',
            'frontend/public/triton/**',
            'test-results/**',
            'playwright-report/**',
            '.cache/**',
            '**/dist/**',
            '**/.next/**',
            '**/out/**',
            '**/out-native/**',
            'desktop/.generated/**',
            'desktop/renderer/**',
            'desktop/out/**',
            'desktop/dist/**',
            '**/next-env.d.ts',
            '**/drizzle/meta/**',
        ],
    },
    js.configs.recommended,
    ...tseslint.configs.recommended,
    { languageOptions: { globals: { ...globals.node, ...globals.browser } } },
    {
        files: ['frontend/**/*.{ts,tsx}'],
        plugins: { '@next/next': next, 'react-hooks': hooks },
        settings: { next: { rootDir: 'frontend/' } },
        rules: {
            ...next.configs.recommended.rules,
            ...next.configs['core-web-vitals'].rules,
            'react-hooks/rules-of-hooks': 'error',
            'react-hooks/exhaustive-deps': 'error',
        },
    },
    {
        files: ['**/*.mjs'],
        rules: {
            '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
        },
    },
)
