// Leaving a Seva event, as the event page and the account's deletion both do
// it (./client.ts, lib/account/deletion.ts): Firestore comes in as two calls,
// so this runs as well on the browser's Lite build as on the tests' fakes.

import type { DocPath, Op } from '@/lib/firebase/ops';
import { errorKind } from './errors';
import { eventPath, planDropNote, planForget, planLeave, volunteerPath, type Sentinels } from './plans';

export type LeaveIO = {
    commit(ops: Op[]): Promise<void>;
    get(path: DocPath): Promise<Record<string, unknown> | null>;
};

// A document the rules won't let this account read reads as missing.
async function readable(io: LeaveIO, path: DocPath) {
    try {
        return await io.get(path);
    } catch (error) {
        if (errorKind(error) === 'denied') return null;
        throw error;
    }
}

// Leaving gives the spot back: the sign-up, the volunteer's note of it and
// one off the count, together. A sign-up its host has already cleared
// (winding the event down) leaves only the note; one whose event is gone has
// no count to give the spot back to, so the sign-up and the note go.
export async function leaveEvent(io: LeaveIO, uid: string, eventId: string, key: string, s: Sentinels): Promise<void> {
    try {
        await io.commit(planLeave(uid, eventId, key, s));
        return;
    } catch (error) {
        if (errorKind(error) === 'unavailable') throw error;
        if (await readable(io, volunteerPath(eventId, key)) === null) return io.commit(planDropNote(uid, eventId));
        if (await readable(io, eventPath(eventId)) !== null) throw error;
    }
    await io.commit(planForget(uid, eventId, key));
}
