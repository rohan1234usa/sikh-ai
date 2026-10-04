// Whether this browser was signed in last time, so Firebase Auth (about 50 KB
// of script) loads straight away only for visitors who need it. AuthContext
// keeps the hint in step with Auth; a pre-paint script copies it onto <html>
// as data-auth, so a returning member never sees a "Sign in" button flash up
// while their session is restored. No SDK imports here.

export const AUTH_HINT_KEY = 'sikhai.auth';

// '1' signed in, '0' signed out, null: never recorded (a first visit, or a
// browser from before the hint existed). A first visit records '0' as soon
// as it's clear there's no session (AuthContext).
export type AuthHint = '1' | '0' | null;

export function readAuthHint(): AuthHint {
    try {
        const v = localStorage.getItem(AUTH_HINT_KEY);
        return v === '1' || v === '0' ? v : null;
    } catch {
        return null;
    }
}

export function writeAuthHint(signedIn: boolean) {
    const v = signedIn ? '1' : '0';
    try {
        localStorage.setItem(AUTH_HINT_KEY, v);
    } catch {
        // Blocked storage: Auth then loads on the way to sign-in, as for anyone new.
    }
    document.documentElement.dataset.auth = v;
}

// What to do on arrival. `firebaseDb` is whether the browser holds Auth's own
// database (null: it can't say), consulted only when there's no hint: every
// visitor from before the hint has one, since Auth used to start on every
// page, and only Auth can tell whether it holds a session.
export function planAuthStart(hint: AuthHint, firebaseDb: boolean | null): 'restore' | 'check' | 'wait' {
    if (hint === '1') return 'restore'; // load now; a session is on its way
    if (hint === '0') return 'wait'; // signed out: load on the way to sign-in
    return firebaseDb === false ? 'wait' : 'check'; // load once to find out
}

// Firebase Auth's IndexedDB database, where a signed-in session is kept.
export const FIREBASE_AUTH_DB = 'firebaseLocalStorageDb';

export async function hasFirebaseAuthDb(): Promise<boolean | null> {
    try {
        if (typeof indexedDB === 'undefined' || !indexedDB.databases) return null;
        const dbs = await indexedDB.databases();
        return dbs.some((d) => d.name === FIREBASE_AUTH_DB);
    } catch {
        return null;
    }
}

// Runs before first paint (see app/[lang]/layout.tsx), alongside the theme script.
export const AUTH_HINT_SCRIPT = `try{if(localStorage.getItem('${AUTH_HINT_KEY}')==='1')document.documentElement.dataset.auth='1'}catch(e){}`;
