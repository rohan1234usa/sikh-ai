// BROWSER-ONLY: Seva's reads and writes for someone signed in, on Firestore
// Lite. The pages reach this only through import() (app/components/seva/
// sevaClient.ts), so a visitor who just looks never downloads Firestore.
// Writes are the plans in ./plans.ts, one batch each; reads go through the
// same parsers as the server's, as untrusted.

import {
    collection,
    doc,
    getDoc,
    getDocs,
    increment,
    limit,
    orderBy,
    query,
    serverTimestamp,
    where,
    writeBatch,
    type Firestore,
} from 'firebase/firestore/lite';
import type { Op } from '@/lib/firebase/ops';
import type { EventStatus } from './config';
import { errorKind } from './errors';
import { parseEvent, parseReport, parseSignup, parseVolunteer, toMillis } from './event';
import { SEVA_PAGE_MAX } from './limits';
import type { EventFields, EventPatch, Hosting, Report, ReportFields, SevaEvent, Signup, Volunteer, VolunteerFields } from './model';
import {
    adminPath,
    eventPath,
    hostingPath,
    planCreateEvent,
    planDismissReports,
    planForget,
    planJoin,
    planLeave,
    planReport,
    planSetHidden,
    planSetStatus,
    planUpdateEvent,
    planUpdateSignup,
    reportPath,
    signupPath,
    volunteerPath,
} from './plans';

// What a signed-in viewer is to one event.
export type ViewerOfEvent = {
    signup: Signup | null;
    volunteer: Volunteer | null;
    isHost: boolean;
    isAdmin: boolean;
    reported: boolean;
    // The event as it is now: fresher than the cached page, and for its host
    // or an admin, even while hidden. Null if it can't be read.
    event: SevaEvent | null;
};

export function sevaClient(db: Firestore) {
    const S = { now: serverTimestamp(), inc: increment };
    const ref = (path: string[]) => doc(db, path.join('/'));

    async function commit(ops: Op[]): Promise<void> {
        if (ops.length === 0) return;
        const batch = writeBatch(db);
        for (const op of ops) {
            if (op.type === 'set') batch.set(ref(op.path), op.data);
            else if (op.type === 'update') batch.update(ref(op.path), op.data);
            else batch.delete(ref(op.path));
        }
        await batch.commit();
    }

    // A read the rules may refuse (someone else's, or hidden): null then.
    async function tryGet(path: string[]) {
        try {
            const snap = await getDoc(ref(path));
            return snap.exists() ? snap.data() : null;
        } catch (error) {
            if (errorKind(error) === 'denied') return null;
            throw error;
        }
    }

    async function getEvent(id: string, { allowHidden = false } = {}): Promise<SevaEvent | null> {
        return parseEvent(id, await tryGet(eventPath(id)), { allowHidden });
    }

    return {
        isAdmin: async (uid: string) => (await tryGet(adminPath(uid))) !== null,

        getEvent,

        async viewerOf(uid: string, eventId: string): Promise<ViewerOfEvent> {
            const [signupData, hosting, admin, report] = await Promise.all([
                tryGet(signupPath(uid, eventId)),
                tryGet(hostingPath(uid, eventId)),
                tryGet(adminPath(uid)),
                tryGet(reportPath(eventId, uid)),
            ]);
            const signup = parseSignup(eventId, signupData);
            const isHost = hosting !== null;
            const isAdmin = admin !== null;
            const [volunteerData, event] = await Promise.all([
                signup ? tryGet(volunteerPath(eventId, signup.volunteerId)) : null,
                getEvent(eventId, { allowHidden: isHost || isAdmin }),
            ]);
            return {
                signup,
                volunteer: signup ? parseVolunteer(signup.volunteerId, volunteerData) : null,
                isHost,
                isAdmin,
                reported: report !== null,
                event,
            };
        },

        async create(uid: string, fields: EventFields): Promise<string> {
            const id = doc(collection(db, 'seva_events')).id;
            await commit(planCreateEvent(uid, id, fields, S));
            return id;
        },

        update: (eventId: string, patch: EventPatch) => commit(planUpdateEvent(eventId, patch, S)),

        setStatus: (eventId: string, status: EventStatus, cancelNote: string) => commit(planSetStatus(eventId, status, cancelNote, S)),

        async join(uid: string, eventId: string, v: VolunteerFields): Promise<Signup> {
            const key = doc(collection(db, 'seva_events', eventId, 'volunteers')).id;
            await commit(planJoin(uid, eventId, key, v, S));
            return { eventId, volunteerId: key, joinedAt: Date.now() };
        },

        updateSignup: (eventId: string, key: string, v: VolunteerFields) => commit(planUpdateSignup(eventId, key, v)),

        // Leaving gives the spot back; if the event is gone, there's no count
        // to give it back to, so the sign-up is just removed.
        async leave(uid: string, eventId: string, key: string): Promise<void> {
            try {
                await commit(planLeave(uid, eventId, key, S));
            } catch (error) {
                if (errorKind(error) === 'unavailable') throw error;
                if (await tryGet(eventPath(eventId)) !== null) throw error;
                await commit(planForget(uid, eventId, key));
            }
        },

        report: (uid: string, eventId: string, r: ReportFields) => commit(planReport(uid, eventId, r, S)),

        setHidden: (eventId: string, hidden: boolean) => commit(planSetHidden(eventId, hidden)),

        async dismissReports(ids: string[]): Promise<void> {
            for (const batch of planDismissReports(ids)) await commit(batch);
        },

        // The host's list of who joined, earliest first.
        async volunteers(eventId: string): Promise<Volunteer[]> {
            const snap = await getDocs(query(collection(db, 'seva_events', eventId, 'volunteers'), orderBy('joinedAt')));
            return snap.docs.flatMap((d) => parseVolunteer(d.id, d.data()) ?? []);
        },

        // "Your seva": the sign-ups and events in this account's own notes,
        // each with its event as it is now (null once it's gone or hidden).
        async mine(uid: string): Promise<{ joined: { signup: Signup; event: SevaEvent | null }[]; hosting: { hosting: Hosting; event: SevaEvent | null }[] }> {
            const [signups, hosted] = await Promise.all([
                getDocs(query(collection(db, 'users', uid, 'seva_signups'), limit(SEVA_PAGE_MAX))),
                getDocs(query(collection(db, 'users', uid, 'seva_hosting'), limit(SEVA_PAGE_MAX))),
            ]);
            const joined = await Promise.all(signups.docs.flatMap((d) => {
                const signup = parseSignup(d.id, d.data());
                return signup ? [getEvent(d.id).then((event) => ({ signup, event }))] : [];
            }));
            const hosting = await Promise.all(hosted.docs.map(async (d) => ({
                hosting: { eventId: d.id, createdAt: toMillis(d.data().createdAt) ?? 0 },
                event: await getEvent(d.id, { allowHidden: true }),
            })));
            return { joined, hosting };
        },

        // For admins: every report, and every hidden event.
        async reports(): Promise<Report[]> {
            const snap = await getDocs(query(collection(db, 'seva_reports'), orderBy('createdAt', 'desc'), limit(500)));
            return snap.docs.flatMap((d) => parseReport(d.id, d.data()) ?? []);
        },

        async hiddenEvents(): Promise<SevaEvent[]> {
            const snap = await getDocs(query(collection(db, 'seva_events'), where('hidden', '==', true), limit(SEVA_PAGE_MAX)));
            return snap.docs.flatMap((d) => parseEvent(d.id, d.data(), { allowHidden: true }) ?? []);
        },
    };
}

export type SevaClient = ReturnType<typeof sevaClient>;
