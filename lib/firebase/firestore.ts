// Firestore, for the pages that use it: shared chats, and account chats
// (which load it themselves, only when they're on and someone is signed in).
// Seva uses the smaller Lite build instead (./firestoreLite.ts).

import { connectFirestoreEmulator, getFirestore } from 'firebase/firestore';
import { app } from './app';
import { EMULATOR_HOSTS, useEmulators } from './config';

export const db = getFirestore(app);

// Local testing (README, "Testing Seva locally"): account chats and shared
// links on the emulator too, as Seva's Lite build does (./firestoreLite.ts).
if (useEmulators) {
    const [host, port] = EMULATOR_HOSTS.firestore.split(':');
    connectFirestoreEmulator(db, host, Number(port));
}
