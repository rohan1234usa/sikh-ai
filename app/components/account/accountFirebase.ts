// The account deletion with Firestore bound: loaded only through
// accountDeletion.ts's import(), so Firestore Lite reaches the browser for it
// only once someone has confirmed they want their account deleted.

import { accountIO } from '@/lib/account/client';
import { dbLite } from '@/lib/firebase/firestoreLite';

export { deleteAccountData } from '@/lib/account/deletion';
export const io = accountIO(dbLite);
