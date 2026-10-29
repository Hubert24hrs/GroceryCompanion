// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');

module.exports = defineConfig([
    expoConfig,
    {
        ignores: ['dist/*', 'web-build/*', 'node_modules/*', '.expo/*'],
    },
    {
        files: ['supabase/tests/**/*.js', 'jest.setup.js', '**/__tests__/**'],
        languageOptions: { globals: { jest: 'readonly', describe: 'readonly', test: 'readonly', expect: 'readonly', beforeAll: 'readonly', beforeEach: 'readonly', afterEach: 'readonly', it: 'readonly' } },
    },
]);
