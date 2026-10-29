module.exports = {
    projects: [
        {
            displayName: 'app',
            preset: 'jest-expo',
            testMatch: ['<rootDir>/src/**/__tests__/**/*.test.ts?(x)'],
            setupFiles: ['<rootDir>/jest.setup.js'],
        },
        {
            // Firestore security rules; needs the emulator (npm run test:rules).
            displayName: 'rules',
            testEnvironment: 'node',
            testMatch: ['<rootDir>/firebase/tests/**/*.test.js'],
            transform: {},
        },
    ],
};
