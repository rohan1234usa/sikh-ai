// Firebase Auth. Only AuthContext loads this, with import(), and only once
// it's needed: see app/context/AuthContext.tsx.

import { GoogleAuthProvider, connectAuthEmulator, getAuth, signInWithCredential } from 'firebase/auth';
import { app } from './app';
import { EMULATOR_HOSTS, useEmulators } from './config';

export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();

if (useEmulators) {
    connectAuthEmulator(auth, `http://${EMULATOR_HOSTS.auth}`, { disableWarnings: true });
    // Local testing only: sign in as a seeded emulator account (scripts/
    // seva-seed.ts) with the emulator's fake Google credential, for tools that
    // can't use its popup (a browser that drops the popup's opener). The flag
    // is fixed when the site is built, so a production build has none of it.
    if (typeof window !== 'undefined') {
        (window as unknown as { emulatorSignIn: (sub: string, name?: string) => Promise<unknown> }).emulatorSignIn = (sub, name = sub) =>
            signInWithCredential(auth, GoogleAuthProvider.credential(
                JSON.stringify({ sub, email: `${sub}@example.com`, email_verified: true, name }),
            ));
    }
}

export { onAuthStateChanged, signInWithPopup, signOut } from 'firebase/auth';
