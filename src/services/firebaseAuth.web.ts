import { FirebaseApp } from 'firebase/app';
import { Auth, getAuth } from 'firebase/auth';

/** Web: the default IndexedDB persistence keeps the user signed in. */
export function createAuth(app: FirebaseApp): Auth {
    return getAuth(app);
}
