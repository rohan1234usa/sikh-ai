// A Firestore stand-in for the account deletion's tests: documents by path, a
// batch applied whole or not at all, an update of a missing document refused
// as Firestore refuses it, and hooks for what the rules (or the network)
// would do. tests/rules/account.rules.ts runs the same code on the emulator,
// under the real rules.

import type { AccountIO, StoredDoc } from '@/lib/account/deletion';
import type { DocPath, Op } from '@/lib/firebase/ops';

const NOW = Symbol('now');
const INC = Symbol('inc');
type Inc = { [INC]: number };

const key = (path: DocPath) => path.join('/');
const fail = (code: string) => Object.assign(new Error(code), { code });

export class FakeFirestore implements AccountIO {
    readonly docs = new Map<string, Record<string, unknown>>();
    readonly sentinels = { now: NOW, inc: (n: number): Inc => ({ [INC]: n }) };
    lists = 0;
    gets = 0;
    readonly batches: Op[][] = [];
    // The nth batch (counting from 1) fails as if the connection dropped.
    failAt: number | null = null;
    // A batch the rules would refuse.
    refuse: (ops: Op[], db: FakeFirestore) => boolean = () => false;
    // After each batch is applied, as another device might write.
    afterCommit: (ops: Op[], db: FakeFirestore) => void = () => {};
    private attempts = 0;
    clock = 1_000;

    seed(path: string, data: Record<string, unknown>) {
        this.docs.set(path, data);
        return this;
    }

    has(path: string) {
        return this.docs.has(path);
    }

    // Every document under a path, as paths.
    under(prefix: string): string[] {
        return [...this.docs.keys()].filter((k) => k.startsWith(`${prefix}/`)).sort();
    }

    async list(collection: DocPath, limit: number): Promise<StoredDoc[]> {
        this.lists++;
        const prefix = `${key(collection)}/`;
        return [...this.docs.entries()]
            .filter(([k]) => k.startsWith(prefix) && !k.slice(prefix.length).includes('/'))
            .map(([k, data]) => ({ id: k.slice(prefix.length), data }))
            .sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))
            .slice(0, limit);
    }

    async get(path: DocPath): Promise<Record<string, unknown> | null> {
        this.gets++;
        return this.docs.get(key(path)) ?? null;
    }

    async commit(ops: Op[]): Promise<void> {
        this.attempts++;
        if (this.attempts === this.failAt) throw fail('unavailable');
        if (this.refuse(ops, this)) throw fail('permission-denied');
        const next = new Map(this.docs);
        const now = ++this.clock;
        const value = (v: unknown, before: unknown) => {
            if (v === NOW) return now;
            if (v && typeof v === 'object' && INC in v) return (typeof before === 'number' ? before : 0) + (v as Inc)[INC];
            return v;
        };
        for (const op of ops) {
            const k = key(op.path);
            if (op.type === 'delete') {
                next.delete(k);
            } else if (op.type === 'set') {
                next.set(k, Object.fromEntries(Object.entries(op.data).map(([f, v]) => [f, value(v, undefined)])));
            } else {
                const before = next.get(k);
                if (!before) throw fail('not-found');
                next.set(k, { ...before, ...Object.fromEntries(Object.entries(op.data).map(([f, v]) => [f, value(v, before[f])])) });
            }
        }
        this.docs.clear();
        for (const [k, v] of next) this.docs.set(k, v);
        this.batches.push(ops);
        this.afterCommit(ops, this);
    }
}

// As the rules refuse leaving a sign-up that's already gone (sevaLeaveOk
// needs it there): the count can't go down for it.
export function refuseLeavingWhatsGone(ops: Op[], db: FakeFirestore): boolean {
    return ops.some((op, i) => op.type === 'update' && op.path[0] === 'seva_events' && 'volunteerCount' in op.data
        && ops.slice(0, i).some((o) => o.type === 'delete' && o.path[2] === 'volunteers' && !db.has(key(o.path))));
}
