import { FirebaseApp, initializeApp } from 'firebase/app';
import { Auth, connectAuthEmulator } from 'firebase/auth';
import { connectFirestoreEmulator, Firestore, initializeFirestore } from 'firebase/firestore';
import { connectFunctionsEmulator, Functions, getFunctions } from 'firebase/functions';
import { Platform } from 'react-native';
import { createAuth } from './firebaseAuth';

const config = {
    apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY,
    authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN,
    projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID,
    storageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
    appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID,
};

// The template .env.example ships "your-project" style placeholders; treat those as unset.
const isPlaceholder = (value: string | undefined) => !value || /your[-_.]/i.test(value);

/**
 * False when the build has no Firebase config; the app then runs fully
 * offline with accounts, sync and sharing turned off.
 */
export const isBackendConfigured = !isPlaceholder(config.apiKey) && !isPlaceholder(config.projectId) && !isPlaceholder(config.appId);

/** Talk to `npm run emulators` instead of the real project (local development and tests). */
export const usingEmulators = process.env.EXPO_PUBLIC_FIREBASE_EMULATORS === '1';

let app: FirebaseApp | null = null;
let auth: Auth | null = null;
let firestore: Firestore | null = null;
let functions: Functions | null = null;

if (isBackendConfigured) {
    app = initializeApp(config);
    auth = createAuth(app);
    firestore = initializeFirestore(app, {
        ignoreUndefinedProperties: true,
        // React Native's networking can't hold Firestore's WebChannel stream open; long polling works everywhere.
        experimentalAutoDetectLongPolling: true,
    });
    // Same region the functions are deployed to (functions/src/index.ts).
    functions = getFunctions(app, 'europe-west1');
    if (usingEmulators) {
        // The Android emulator reaches the host machine at 10.0.2.2. A USB phone
        // can use 127.0.0.1 after `adb reverse tcp:9099 tcp:9099` (and 8080, 5001).
        const host = process.env.EXPO_PUBLIC_FIREBASE_EMULATOR_HOST || (Platform.OS === 'android' ? '10.0.2.2' : '127.0.0.1');
        connectAuthEmulator(auth, `http://${host}:9099`, { disableWarnings: true });
        connectFirestoreEmulator(firestore, host, 8080);
        connectFunctionsEmulator(functions, host, 5001);
    }
}

export { auth, firestore, functions };
