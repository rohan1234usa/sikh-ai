// BROWSER-ONLY: Firestore Lite as the account deletion uses it
// (./deletion.ts). Only app/components/account/accountFirebase.ts imports
// this, and that is loaded with import() once someone asks to delete their
// account, so no page ships it before. tests/rules/env.ts gives the same
// three calls on the emulator.

import {
    collection,
    doc,
    getDoc,
    getDocs,
    increment,
    limit,
    query,
    serverTimestamp,
    writeBatch,
    type Firestore,
} from 'firebase/firestore/lite';
import type { AccountIO } from './deletion';

export function accountIO(db: Firestore): AccountIO {
    const ref = (path: string[]) => doc(db, path.join('/'));
    return {
        async list(path, n) {
            const snap = await getDocs(query(collection(db, path.join('/')), limit(n)));
            return snap.docs.map((d) => ({ id: d.id, data: d.data() }));
        },
        async get(path) {
            const snap = await getDoc(ref(path));
            return snap.exists() ? snap.data() : null;
        },
        async commit(ops) {
            const batch = writeBatch(db);
            for (const op of ops) {
                if (op.type === 'set') batch.set(ref(op.path), op.data);
                else if (op.type === 'update') batch.update(ref(op.path), op.data);
                else batch.delete(ref(op.path));
            }
            await batch.commit();
        },
        sentinels: { now: serverTimestamp(), inc: increment },
    };
}
