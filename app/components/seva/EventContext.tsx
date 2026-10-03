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
    // What an account is to the event, once known: for an action that has
    // just signed someone in.
    whenViewer: (user: User) => Promise<ViewerOfEvent>;
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

    // One read per account, shared by the page and an action waiting on it.
    const whenViewer = useCallback((u: User) => {
        if (reading.current?.uid !== u.uid) {
            const promise = loadSeva().then((seva) => seva.viewerOf(u.uid, initial.id));
            promise.catch(() => { if (reading.current?.promise === promise) reading.current = null; });
            reading.current = { uid: u.uid, promise };
        }
        return reading.current.promise;
    }, [initial.id]);

    useEffect(() => {
        if (!user) return;
        let cancelled = false;
        whenViewer(user).then(
            (is) => {
                if (cancelled) return;
                setLoaded({ uid: user.uid, is });
                if (is.event) {
                    const { title, status, cancelNote, volunteerCount, spots, startsAt, endsAt, hidden } = is.event;
                    setEvent((e) => ({ ...e, title, status, cancelNote, volunteerCount, spots, startsAt, endsAt, hidden }));
                }
            },
            () => { if (!cancelled) setLoaded({ uid: user.uid, is: null }); },
        );
        return () => { cancelled = true; };
    }, [user, whenViewer]);

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
    }), [event, viewer, now, endedAtBuild, flash, update, setIs, whenViewer]);

    return <EventContext.Provider value={value}>{children}</EventContext.Provider>;
}
