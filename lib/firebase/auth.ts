// Firebase Auth. Only AuthContext loads this, with import(), and only once
// it's needed: see app/context/AuthContext.tsx.

import { GoogleAuthProvider, getAuth } from 'firebase/auth';
import { app } from './app';

export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();

export { onAuthStateChanged, signInWithPopup, signOut } from 'firebase/auth';
