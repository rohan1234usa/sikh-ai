// Pure: Firestore writes as plain data, so a change can be planned, tested and
// held to the rules without Firestore. Each feature's plans return these
// (lib/chat/store/firestorePlans.ts, lib/seva/plans.ts); an adapter carries
// them out in batches, and tests/rules replays the same plans on the emulator.

export type DocPath = string[];
export type Op =
    | { type: 'set'; path: DocPath; data: Record<string, unknown> }
    | { type: 'update'; path: DocPath; data: Record<string, unknown> }
    | { type: 'delete'; path: DocPath };

// Well under Firestore's 500 writes per batch (and its 10 MiB request).
export const MAX_BATCH_OPS = 400;

// Splits any list of operations into batches Firestore accepts, or smaller
// ones (a batch whose rules read other documents has a budget of its own).
export function chunk(ops: Op[], size = MAX_BATCH_OPS): Op[][] {
    const out: Op[][] = [];
    for (let i = 0; i < ops.length; i += size) out.push(ops.slice(i, i + size));
    return out;
}
