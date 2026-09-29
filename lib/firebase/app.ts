import { getApps, initializeApp } from 'firebase/app';
import { firebaseConfig } from './config';

// One app per page, whichever of auth.ts and firestore.ts loads first.
export const app = getApps()[0] ?? initializeApp(firebaseConfig);
