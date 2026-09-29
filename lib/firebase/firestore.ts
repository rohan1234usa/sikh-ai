// Firestore, for the pages that use it: Seva, shared chats, and account chats
// (which load it themselves, only when they're on and someone is signed in).

import { getFirestore } from 'firebase/firestore';
import { app } from './app';

export const db = getFirestore(app);
