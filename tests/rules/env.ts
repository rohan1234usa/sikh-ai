// The Firestore emulator, as the rules tests use it (firestore.rules):
// `npm run test:rules` starts it (it needs Java) and runs each *.rules.ts file
// in turn, since they share it; CI does the same. Not part of `npm test`,
// which needs nothing running.
//
// Each feature's documents come from the app's own write plans
// (lib/chat/store/firestorePlans.ts, lib/seva/plans.ts), committed as the app
// commits them, so the rules are held to the shapes the app really writes.

import { after, before, beforeEach } from 'node:test';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { initializeTestEnvironment, type RulesTestEnvironment } from '@firebase/rules-unit-testing';
import {
    collection,
    deleteDoc,
    doc,
    getDoc,
    getDocs,
    increment,
    limit,
    query,
    serverTimestamp,
    setDoc,
    setLogLevel,
    writeBatch,
    type DocumentData,
    type Firestore,
} from 'firebase/firestore';
import type { AccountIO } from '@/lib/account/deletion';
import type { Op } from '@/lib/firebase/ops';

// One environment for the file, emptied before each test.
export function rulesEnv() {
    let env: RulesTestEnvironment;

    before(async () => {
        // The SDK logs every refused write as an error. Here refusals are the
        // point, and they'd bury a real failure in the output.
        setLogLevel('silent');
        env = await initializeTestEnvironment({
            projectId: 'demo-sikhai',
            firestore: { rules: readFileSync(resolve(import.meta.dirname, '../../firestore.rules'), 'utf8') },
        });
    });
    after(async () => { await env.cleanup(); });
    beforeEach(async () => { await env.clearFirestore(); });

    // withSecurityRulesDisabled resolves to nothing, so the result is kept here.
    async function admin<T>(fn: (db: Firestore) => Promise<T>): Promise<T> {
        let out!: T;
        await env.withSecurityRulesDisabled(async (ctx) => { out = await fn(ctx.firestore() as unknown as Firestore); });
        return out;
    }

    return {
        // A signed-in account; `email` is what Google's token would carry.
        as: (uid: string, email = `${uid}@example.com`) => env.authenticatedContext(uid, { email }).firestore() as unknown as Firestore,
        anon: () => env.unauthenticatedContext().firestore() as unknown as Firestore,
        // Written or read around the rules, as the console would.
        seed: (path: string, data: DocumentData) => admin((db) => setDoc(doc(db, path), data)),
        wipe: (path: string) => admin((db) => deleteDoc(doc(db, path))),
        peek: (path: string) => admin(async (db) => {
            const snap = await getDoc(doc(db, path));
            return snap.exists() ? snap.data() : null;
        }),
        // The ids of a collection's documents.
        ids: (path: string) => admin(async (db) => (await getDocs(collection(db, path))).docs.map((d) => d.id)),
    };
}

// Firestore as the account deletion uses it (lib/account/deletion.ts), on one
// visitor's connection, as lib/account/client.ts gives it in the browser.
export function accountIO(db: Firestore): AccountIO {
    return {
        async list(path, n) {
            const snap = await getDocs(query(collection(db, path.join('/')), limit(n)));
            return snap.docs.map((d) => ({ id: d.id, data: d.data() }));
        },
        async get(path) {
            const snap = await getDoc(doc(db, path.join('/')));
            return snap.exists() ? snap.data() : null;
        },
        commit: (ops) => commit(db, ops),
        sentinels: { now: serverTimestamp(), inc: increment },
    };
}

// One batch, as the app sends its plans.
export function commit(db: Firestore, ops: Op[]): Promise<void> {
    const batch = writeBatch(db);
    for (const op of ops) {
        const ref = doc(db, op.path.join('/'));
        if (op.type === 'set') batch.set(ref, op.data);
        else if (op.type === 'update') batch.update(ref, op.data);
        else batch.delete(ref);
    }
    return batch.commit();
}
