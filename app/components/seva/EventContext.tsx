'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import type { User } from 'firebase/auth';
import { useAuth } from '@/app/context/AuthContext';
import type { ViewerOfEvent } from '@/lib/seva/client';
import type { SevaEvent } from '@/lib/seva/model';
import { clearFlash, useFlash, useMinute, type Flash } from './hooks';
import { loadSeva } from './sevaClient';

// What the page's islands share about one event: the event as it is now
// (the cached page's copy, overtaken by a fresh read and by whatever the
// viewer does here), who's looking (a volunteer, its host, an admin), and the
// time, which a cached page can't know.

export type LiveEvent = Pick<SevaEvent, 'id' | 'title' | 'status' | 'cancelNote' | 'volunteerCount' | 'spots' | 'startsAt' | 'endsAt' | 'hidden'>;

export type Viewer =
    | { kind: 'signedOut' }
    | { kind: 'loading'; user: User }
    | { kind: 'ready'; user: User; is: ViewerOfEvent }
    | { kind: 'failed'; user: User };

type EventContextValue = {
    event: LiveEvent;
    viewer: Viewer;
    // To the minute; null until the page is interactive, when the server's
    // word stands.
    now: number | null;
    ended: boolean;
    flash: Flash | null;
    dismissFlash: () => void;
    update: (patch: Partial<LiveEvent>) => void;
    // What the viewer is to the event, after they changed it.
    setIs: (patch: Partial<ViewerOfEvent>) => void;
    // What an account is to the event, as it stands (setIs included), once
    // known: for an action, which may have just signed someone in.
    whenViewer: (user: User) => Promise<ViewerOfEvent>;
    // An action (Join, Report) pressed by the event's host before the page
    // knew: the control is about to go, so the host's tools, about to show,
    // take the focus (HostTools takes the hand-off, once).
    handToHost: () => void;
    takeHandOff: () => boolean;
};

const EventContext = createContext<EventContextValue | null>(null);

export function useEvent(): EventContextValue {
    const ctx = useContext(EventContext);
    if (!ctx) throw new Error('useEvent must be used within an EventProvider');
    return ctx;
}

type Loaded = { uid: string; is: ViewerOfEvent | null };

export function EventProvider({ initial, endedAtBuild, children }: { initial: LiveEvent; endedAtBuild: boolean; children: ReactNode }) {
    const { user } = useAuth();
    const [event, setEvent] = useState(initial);
    // What the signed-in account is to the event, once read; null `is` when
    // it couldn't be.
    const [loaded, setLoaded] = useState<Loaded | null>(null);
    const now = useMinute();
    const flash = useFlash(initial.id);
    const reading = useRef<{ uid: string; promise: Promise<ViewerOfEvent> } | null>(null);
    // The account whose read failed, if the page is showing that it did.
    const failedFor = useRef<string | null>(null);
    const handOff = useRef(false);

    // A read that answered, for the page: what the account is to the event,
    // and the event as it is now.
    const apply = useCallback((uid: string, is: ViewerOfEvent) => {
        setLoaded({ uid, is });
        if (is.event) {
            const { title, status, cancelNote, volunteerCount, spots, startsAt, endsAt, hidden } = is.event;
            setEvent((e) => ({ ...e, title, status, cancelNote, volunteerCount, spots, startsAt, endsAt, hidden }));
        }
    }, []);

    // One read per account, shared by the page and an action waiting on it,
    // and kept in step with what the viewer does here (setIs). One that fails
    // is forgotten, so the next asks again; and if that one, asked by an
    // action (Join, Report), answers, the page takes it too, rather than
    // going on saying it couldn't tell (a host's Join would do nothing).
    const remember = useCallback((uid: string, promise: Promise<ViewerOfEvent>) => {
        promise.catch(() => { if (reading.current?.promise === promise) reading.current = null; });
        reading.current = { uid, promise };
        return promise;
    }, []);
    const whenViewer = useCallback((u: User) => {
        if (reading.current?.uid === u.uid) return reading.current.promise;
        const promise = remember(u.uid, loadSeva().then((seva) => seva.viewerOf(u.uid, initial.id)));
        promise.then((is) => {
            if (failedFor.current !== u.uid) return;
            failedFor.current = null;
            apply(u.uid, is);
        }, () => {});
        return promise;
    }, [initial.id, remember, apply]);

    useEffect(() => {
        failedFor.current = null;
        handOff.current = false;
        if (!user) return;
        let cancelled = false;
        whenViewer(user).then(
            (is) => { if (!cancelled) apply(user.uid, is); },
            () => {
                if (cancelled) return;
                failedFor.current = user.uid;
                setLoaded({ uid: user.uid, is: null });
            },
        );
        return () => { cancelled = true; };
    }, [user, whenViewer, apply]);

    // The word after a change on another page lasts for this visit.
    useEffect(() => {
        window.addEventListener('pagehide', clearFlash);
        return () => window.removeEventListener('pagehide', clearFlash);
    }, []);

    const viewer = useMemo<Viewer>(() => (!user
        ? { kind: 'signedOut' }
        : loaded?.uid !== user.uid
            ? { kind: 'loading', user }
            : loaded.is ? { kind: 'ready', user, is: loaded.is } : { kind: 'failed', user }), [user, loaded]);

    const update = useCallback((patch: Partial<LiveEvent>) => setEvent((e) => ({ ...e, ...patch })), []);
    const setIs = useCallback((patch: Partial<ViewerOfEvent>) => {
        setLoaded((l) => (l?.is ? { ...l, is: { ...l.is, ...patch } } : l));
        const r = reading.current;
        if (r) remember(r.uid, r.promise.then((is) => ({ ...is, ...patch })));
    }, [remember]);
    const handToHost = useCallback(() => { handOff.current = true; }, []);
    const takeHandOff = useCallback(() => {
        const handed = handOff.current;
        handOff.current = false;
        return handed;
    }, []);

    const value = useMemo<EventContextValue>(() => ({
        event,
        viewer,
        now,
        ended: now === null ? endedAtBuild : event.endsAt <= now,
        flash,
        dismissFlash: clearFlash,
        update,
        setIs,
        whenViewer,
        handToHost,
        takeHandOff,
    }), [event, viewer, now, endedAtBuild, flash, update, setIs, whenViewer, handToHost, takeHandOff]);

    return <EventContext.Provider value={value}>{children}</EventContext.Provider>;
}
