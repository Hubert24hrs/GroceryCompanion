import AsyncStorage from '@react-native-async-storage/async-storage';
// `firebase/auth` re-exports @firebase/auth, but only @firebase/auth's react-native
// build (and its typings) carry getReactNativePersistence.
import { Auth, getReactNativePersistence, initializeAuth } from '@firebase/auth';
import { FirebaseApp } from 'firebase/app';

/** iOS/Android: keep the signed-in user in AsyncStorage across launches. */
export function createAuth(app: FirebaseApp): Auth {
    return initializeAuth(app, { persistence: getReactNativePersistence(AsyncStorage) });
}
