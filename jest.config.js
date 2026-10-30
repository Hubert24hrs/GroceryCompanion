module.exports = {
    projects: [
        {
            displayName: 'app',
            preset: 'jest-expo',
            testMatch: ['<rootDir>/src/**/__tests__/**/*.test.ts?(x)'],
            setupFiles: ['<rootDir>/jest.setup.js'],
            // Expo's recommended list, plus uuid (ESM-only since v10).
            transformIgnorePatterns: [
                'node_modules/(?!((jest-)?react-native|@react-native(-community)?)|expo(nent)?|@expo(nent)?/.*|@expo-google-fonts/.*|react-navigation|@react-navigation/.*|uuid)',
            ],
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
