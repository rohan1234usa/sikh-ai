// Firestore Lite, for Seva and for deleting an account: reads and batched
// writes, without the live listeners neither uses, at about a third of the
// full SDK's size. Only app/components/seva/sevaFirebase.ts and app/
// components/account/accountFirebase.ts import it, each loaded with import()
// when someone signed in needs it, so visitors never download it.

import { connectFirestoreEmulator, getFirestore } from 'firebase/firestore/lite';
import { app } from './app';
import { EMULATOR_HOSTS, useEmulators } from './config';

export const dbLite = getFirestore(app);

if (useEmulators) {
    const [host, port] = EMULATOR_HOSTS.firestore.split(':');
    connectFirestoreEmulator(dbLite, host, Number(port));
}
