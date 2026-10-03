// Pure: deleting everything an account keeps in Firestore, from the browser,
// under the rules (#42). There's no server with more rights than the account
// itself, so this is the account undoing its own writes, with the app's own
// plans; tests/rules/account.rules.ts runs it on the emulator.
//
// What goes, most public first:
//   links    users/{uid}/shares: each link's public copy, with the note of it
//   events   users/{uid}/seva_hosting: each event, cancelled if it isn't,
//            its sign-ups cleared, then the event with the note
//   signups  users/{uid}/seva_signups: leaving each event
//   chats    users/{uid}/chats: each chat's entries, then the chat
// What stays: reports this account sent (the admins deal with them),
// admins/{uid}, other volunteers' notes of its events (their Your seva says
// "removed"), and what this browser keeps. The caller deletes the Firebase
// Auth user last: until then the rules know who is asking.
//
// Every batch is whole or nothing, and each step lists what's left before it
// acts, so a run cut short anywhere is finished by running it again. A last
// look catches what another device adds meanwhile.

import type { DocPath, Op } from '@/lib/firebase/ops';
import { ERASE_PAGE, chatPath, planErasePage, planUnlinkShares } from '@/lib/chat/store/firestorePlans';
import { DELETION_STEPS, type DeletionStep } from './steps';
import { toMillis } from '@/lib/seva/event';
import { errorKind } from '@/lib/seva/errors';
import {
    eventPath,
    planClearSignups,
    planDeleteEvent,
    planDropNote,
    planForget,
    planLeave,
    planSetStatus,
    volunteerPath,
    type Sentinels,
} from '@/lib/seva/plans';

export type StoredDoc = { id: string; data: Record<string, unknown> };

// Firestore, as much as this needs: the browser's is lib/account/client.ts.
export type AccountIO = {
    // A collection's first `limit` documents, by id.
    list(collection: DocPath, limit: number): Promise<StoredDoc[]>;
    get(path: DocPath): Promise<Record<string, unknown> | null>;
    // One batch; rejects with Firestore's error (its `code`).
    commit(ops: Op[]): Promise<void>;
    sentinels: Sentinels;
};

export { DELETION_STEPS, problemOf, type DeletionProblem, type DeletionStep } from './steps';

export type DeletionOptions = {
    // Each step as it starts, in the first round.
    onStep?: (step: DeletionStep) => void;
    // An event deleted, whose cached pages can now be refreshed.
    onEventRemoved?: (eventId: string) => void;
    // Rounds before giving up on something another device keeps adding.
    maxRounds?: number;
};

// Why a run stopped without Firestore saying so:
// - not_theirs: an event at the id of one this account hosted, posted by
//   someone else after the first was deleted in the console. The account's
//   note still names it, and this won't touch what isn't the account's.
// - stuck: something stays however often it's removed.
export class AccountDeletionError extends Error {
    constructor(readonly kind: 'not_theirs' | 'stuck') {
        super(`Account deletion stopped: ${kind}`);
        this.name = 'AccountDeletionError';
    }
}

const PAGE = 50;
const VOLUNTEERS_PAGE = 100;
const users = (uid: string, collection: string): DocPath => ['users', uid, collection];
const COLLECTIONS: Record<DeletionStep, string> = {
    links: 'shares',
    events: 'seva_hosting',
    signups: 'seva_signups',
    chats: 'chats',
};

async function commitAll(io: AccountIO, batches: Op[][]) {
    for (const ops of batches) await io.commit(ops);
}

// A collection a page at a time, each page handled, until it's empty. True if
// there was anything. A page that comes back as it was after it was handled
// holds something that won't go.
async function drain(io: AccountIO, collection: DocPath, size: number, handle: (page: StoredDoc[]) => Promise<void>): Promise<boolean> {
    let previous: string | null = null;
    for (let found = false; ; found = true) {
        const page = await io.list(collection, size);
        if (page.length === 0) return found;
        const ids = page.map((d) => d.id).join('/');
        if (ids === previous) throw new AccountDeletionError('stuck');
        previous = ids;
        await handle(page);
    }
}

function links(io: AccountIO, uid: string) {
    return drain(io, users(uid, 'shares'), PAGE, (page) => commitAll(io, planUnlinkShares(uid, page.map((d) => d.id))));
}

// An event this account hosts: cancelled if it isn't, its sign-ups cleared
// while it still holds its id, then deleted with the note of it. One already
// gone (deleted in the console) still has its leftovers cleared.
async function windDown(io: AccountIO, uid: string, note: StoredDoc, opts: DeletionOptions) {
    const eventId = note.id;
    const event = await io.get(eventPath(eventId));
    if (event) {
        // The event and the note are written in one batch, at one time.
        if (toMillis(event.createdAt) !== toMillis(note.data.createdAt)) throw new AccountDeletionError('not_theirs');
        if (event.status !== 'cancelled') await io.commit(planSetStatus(eventId, 'cancelled', '', io.sentinels));
    }
    await drain(io, [...eventPath(eventId), 'volunteers'], VOLUNTEERS_PAGE,
        (page) => commitAll(io, planClearSignups(eventId, page.map((d) => d.id))));
    await io.commit(planDeleteEvent(uid, eventId));
    opts.onEventRemoved?.(eventId);
}

function events(io: AccountIO, uid: string, opts: DeletionOptions) {
    return drain(io, users(uid, 'seva_hosting'), PAGE, async (page) => {
        for (const note of page) await windDown(io, uid, note, opts);
    });
}

// As the event page leaves (lib/seva/client.ts): the spot back on the count;
// or, for a sign-up its host has cleared, the note alone; or, for an event
// that's gone, the sign-up and the note.
async function leave(io: AccountIO, uid: string, note: StoredDoc) {
    const eventId = note.id;
    const key = note.data.volunteerId;
    // A note the app didn't write: left alone, and the step stops as stuck.
    if (typeof key !== 'string') return;
    try {
        await io.commit(planLeave(uid, eventId, key, io.sentinels));
        return;
    } catch (error) {
        if (errorKind(error) === 'unavailable') throw error;
    }
    if (await io.get(volunteerPath(eventId, key)) === null) await io.commit(planDropNote(uid, eventId));
    else await io.commit(planForget(uid, eventId, key));
}

function signups(io: AccountIO, uid: string) {
    return drain(io, users(uid, 'seva_signups'), PAGE, async (page) => {
        for (const note of page) await leave(io, uid, note);
    });
}

async function erase(io: AccountIO, uid: string, chatId: string) {
    for (;;) {
        const entries = await io.list([...chatPath(uid, chatId), 'entries'], ERASE_PAGE);
        const last = entries.length < ERASE_PAGE;
        await io.commit(planErasePage(uid, chatId, entries.map((e) => e.id), last));
        if (last) return;
    }
}

function chats(io: AccountIO, uid: string) {
    return drain(io, users(uid, 'chats'), PAGE, async (page) => {
        for (const chat of page) await erase(io, uid, chat.id);
    });
}

const STEPS: Record<DeletionStep, (io: AccountIO, uid: string, opts: DeletionOptions) => Promise<boolean>> = {
    links,
    events,
    signups,
    chats,
};

async function anythingLeft(io: AccountIO, uid: string): Promise<boolean> {
    const pages = await Promise.all(DELETION_STEPS.map((step) => io.list(users(uid, COLLECTIONS[step]), 1)));
    return pages.some((page) => page.length > 0);
}

export async function deleteAccountData(io: AccountIO, uid: string, opts: DeletionOptions = {}): Promise<void> {
    const rounds = opts.maxRounds ?? 3;
    for (let round = 1; ; round++) {
        let found = false;
        for (const step of DELETION_STEPS) {
            if (round === 1) opts.onStep?.(step);
            if (await STEPS[step](io, uid, opts)) found = true;
        }
        // An account with nothing in it costs one read a step.
        if (!found || !(await anythingLeft(io, uid))) return;
        if (round >= rounds) throw new AccountDeletionError('stuck');
    }
}

