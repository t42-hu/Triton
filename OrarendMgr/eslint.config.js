const { defineConfig } = require('eslint/config');
const expo = require('eslint-config-expo/flat');
module.exports = defineConfig([expo, { ignores: ['dist/**', 'dist-native/**'] }, { files: ['src/domain/**/*.{ts,tsx}', 'src/data/**/*.{ts,tsx}', 'src/features/**/*.{ts,tsx}', 'src/app/**/*.{ts,tsx}'], rules: { 'max-lines-per-function': ['error', { max: 40, skipBlankLines: true, skipComments: true }], 'max-depth': ['error', 2], 'max-nested-callbacks': ['error', 1], '@typescript-eslint/no-explicit-any': 'error' } }]);
