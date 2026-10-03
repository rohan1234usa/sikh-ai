// Seva's Firestore, bound: loaded only through sevaClient.ts's import(), so
// Firestore Lite reaches the browser only when someone signed in needs it.

import { dbLite } from '@/lib/firebase/firestoreLite';
import { sevaClient } from '@/lib/seva/client';

export const seva = sevaClient(dbLite);
