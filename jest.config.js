module.exports = {
    projects: [
        {
            displayName: 'app',
            preset: 'jest-expo',
            testMatch: ['<rootDir>/src/**/__tests__/**/*.test.ts?(x)'],
            setupFiles: ['<rootDir>/jest.setup.js'],
        },
        {
            displayName: 'db',
            testEnvironment: 'node',
            testMatch: ['<rootDir>/supabase/tests/**/*.test.js'],
            transform: {},
        },
    ],
};
