// BROWSER-ONLY: a write plan (./ops.ts) carried out on Firestore Lite, in one
// batch. Seva's client and the account deletion share it (lib/seva/client.ts,
// lib/account/client.ts); both are reached only through import().

import { doc, writeBatch, type Firestore } from 'firebase/firestore/lite';
import type { Op } from './ops';

export async function commitLite(db: Firestore, ops: Op[]): Promise<void> {
    if (ops.length === 0) return;
    const batch = writeBatch(db);
    for (const op of ops) {
        const ref = doc(db, op.path.join('/'));
        if (op.type === 'set') batch.set(ref, op.data);
        else if (op.type === 'update') batch.update(ref, op.data);
        else batch.delete(ref);
    }
    await batch.commit();
}
