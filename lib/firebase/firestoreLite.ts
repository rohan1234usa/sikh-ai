// Firestore Lite, for Seva: reads and batched writes, without the live
// listeners Seva doesn't use, at about a third of the full SDK's size. Only
// app/components/seva/sevaFirebase.ts imports it, and that is loaded with
// import() when someone signed in needs it, so visitors never download it.

import { connectFirestoreEmulator, getFirestore } from 'firebase/firestore/lite';
import { app } from './app';
import { EMULATOR_HOSTS, useEmulators } from './config';

export const dbLite = getFirestore(app);

if (useEmulators) {
    const [host, port] = EMULATOR_HOSTS.firestore.split(':');
    connectFirestoreEmulator(dbLite, host, Number(port));
}
