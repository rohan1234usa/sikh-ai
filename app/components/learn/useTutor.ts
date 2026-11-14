'use client';

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react';
import {
    EMPTY_SESSION,
    MAX_TUTOR_REPLY_CHARS,
    TUTOR_SESSION_KEY,
    appendExchange,
    cap,
    historyFor,
    parseTutorSession,
    settleReply,
    startSession,
    tutorErrorCode,
    type HistoryTurn,
    type StreamOutcome,
    type TutorReply,
    type TutorSession,
} from '@/lib/learn/tutor';

// The Punjabi tutor's conversation. It lasts as long as the tab: it is kept
// in sessionStorage, so a reload keeps it (a reply cut off by the reload is
// marked so), and closing the tab ends it. The rules are in
// lib/learn/tutor.ts; this hook streams the replies and keeps the copy.
//
// A lesson comes from the address (?lesson=<slug>). Opening a different
// lesson, or one that doesn't exist, starts a new conversation; the
// parameter is then dropped from the address, so a reload continues the
// conversation rather than restarting it.

// While a reply streams, it is saved at most this often, and once more when
// the page goes away or the tutor is left by a link, as the chat does.
const SAVE_EVERY_MS = 1000;

// False when storage is full or blocked: the conversation then lasts for
// this page.
function save(session: TutorSession): boolean {
    try {
        sessionStorage.setItem(TUTOR_SESSION_KEY, JSON.stringify(session));
        return true;
    } catch {
        return false;
    }
}

// The conversation as the page shows it. Until the tab's copy has been read
// it is empty and not `hydrated`: on the server, and in the browser's first
// render, which must match the server's.
type TutorState = { session: TutorSession; hydrated: boolean; lessonNotFound: boolean };
const NOT_READ: TutorState = { session: EMPTY_SESSION, hydrated: false, lessonNotFound: false };

// What the tab kept, with the address's lesson applied. Only readable once
// the tutor is mounted: the server knows neither, and after a link from
// another page the address is still that page's while this one renders.
function readStart(): TutorState {
    let kept = EMPTY_SESSION;
    try {
        const raw = sessionStorage.getItem(TUTOR_SESSION_KEY);
        if (raw) kept = parseTutorSession(JSON.parse(raw));
    } catch { /* blocked or corrupt: start empty */ }
    // The address keeps its ?lesson= until the session holding the lesson is
    // saved (useTutor's saving effect), so reading it twice, as development
    // does, gives the same thing both times.
    const requested = new URL(window.location.href).searchParams.get('lesson');
    return { ...startSession(kept, requested), hydrated: true };
}

// One mounted tutor's conversation. It lives outside React's state so the
// page reads it with useSyncExternalStore (the server's answer, then the
// tab's), and so whatever saves it (a pagehide, leaving by a link) has the
// latest without waiting for a render.
function createTutorStore() {
    let state = NOT_READ;
    const listeners = new Set<() => void>();
    return {
        get: () => state,
        set(next: TutorState) {
            state = next;
            for (const listener of [...listeners]) listener();
        },
        subscribe(listener: () => void) {
            listeners.add(listener);
            return () => { listeners.delete(listener); };
        },
    };
}

export function useTutor() {
    const [store] = useState(createTutorStore);
    const { session, hydrated, lessonNotFound } = useSyncExternalStore(store.subscribe, store.get, () => NOT_READ);
    const controllerRef = useRef<AbortController | null>(null);
    const savedAtRef = useRef(0);
    // A reply is on its way exactly when the last one is streaming.
    const busy = session.exchanges.at(-1)?.reply.status === 'streaming';

    const setSession = useCallback((change: (session: TutorSession) => TutorSession) => {
        const now = store.get();
        store.set({ ...now, session: change(now.session) });
    }, [store]);

    useEffect(() => {
        store.set(readStart());
        const onHide = () => save(store.get().session);
        window.addEventListener('pagehide', onHide);
        return () => {
            // Leaving by a link unmounts the tutor without a pagehide.
            save(store.get().session);
            window.removeEventListener('pagehide', onHide);
            controllerRef.current?.abort();
        };
    }, [store]);

    // Saved on every change, and while a reply's text streams in once a
    // second, so a reload keeps what had arrived. A new question is saved at
    // once.
    useEffect(() => {
        if (!hydrated) return;
        const now = Date.now();
        const last = session.exchanges.at(-1)?.reply;
        if (last?.status === 'streaming' && last.text !== '' && now - savedAtRef.current < SAVE_EVERY_MS) return;
        savedAtRef.current = now;
        if (!save(session)) return;
        // Saved, so the lesson no longer needs the address: a reload now
        // continues the conversation instead of starting it again. The state
        // is null, as in the chat, so Next's router follows the new address.
        const url = new URL(window.location.href);
        if (url.searchParams.has('lesson')) {
            url.searchParams.delete('lesson');
            window.history.replaceState(null, '', url.pathname + url.search + url.hash);
        }
    }, [session, hydrated]);

    const setReply = useCallback((id: string, reply: TutorReply) => {
        setSession((s) => ({ ...s, exchanges: s.exchanges.map((e) => (e.id === id ? { ...e, reply } : e)) }));
    }, [setSession]);

    const stream = useCallback(async (id: string, message: string, history: HistoryTurn[], lesson: string | null) => {
        const controller = new AbortController();
        controllerRef.current = controller;
        let text = '';
        let outcome: StreamOutcome;
        try {
            const res = await fetch('/api/learn', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ message, history, lesson }),
                signal: controller.signal,
            });
            if (!res.ok || !res.body) {
                // A rate limiter or proxy in front of the API can answer with HTML.
                const data = res.headers.get('content-type')?.includes('json') ? await res.json().catch(() => null) : null;
                outcome = { kind: 'http', code: tutorErrorCode(res.status, data) };
            } else {
                const reader = res.body.getReader();
                const decoder = new TextDecoder();
                for (;;) {
                    const { done, value } = await reader.read();
                    if (done) break;
                    const chunk = decoder.decode(value, { stream: true });
                    if (!chunk) continue;
                    const whole = text + chunk;
                    text = cap(whole, MAX_TUTOR_REPLY_CHARS);
                    setReply(id, { text, status: 'streaming' });
                    // A runaway reply: stop the server generating the rest,
                    // and keep it, marked as cut off.
                    if (text.length < whole.length) {
                        controller.abort();
                        throw new Error('The reply reached its length cap');
                    }
                }
                outcome = { kind: 'closed' };
            }
        } catch {
            outcome = controller.signal.aborted ? { kind: 'aborted' } : { kind: 'failed' };
        }
        setReply(id, settleReply({ text, status: 'streaming' }, outcome));
        if (controllerRef.current === controller) controllerRef.current = null;
    }, [setReply]);

    const send = useCallback((raw: string) => {
        const question = raw.trim();
        if (!question || controllerRef.current) return false;
        const { exchanges, lesson } = store.get().session;
        const id = crypto.randomUUID();
        const history = historyFor(exchanges);
        setSession((s) => ({ ...s, exchanges: appendExchange(s.exchanges, { id, question, reply: { text: '', status: 'streaming' } }) }));
        void stream(id, question, history, lesson);
        return true;
    }, [store, setSession, stream]);

    // Asks the last question again, after an error or a Stop before any text.
    const retry = useCallback(() => {
        const { exchanges, lesson } = store.get().session;
        const last = exchanges.at(-1);
        if (!last || controllerRef.current) return;
        setReply(last.id, { text: '', status: 'streaming' });
        void stream(last.id, last.question, historyFor(exchanges.slice(0, -1)), lesson);
    }, [store, setReply, stream]);

    const stop = useCallback(() => controllerRef.current?.abort(), []);

    // A new conversation, about the same lesson if there is one. A reply
    // still streaming is cut off and let go at once, so the input is ready
    // before the old request has finished unwinding.
    const reset = useCallback(() => {
        controllerRef.current?.abort();
        controllerRef.current = null;
        const now = store.get();
        store.set({ ...now, lessonNotFound: false, session: { lesson: now.session.lesson, exchanges: [] } });
    }, [store]);

    const dismissLesson = useCallback(() => setSession((s) => ({ ...s, lesson: null })), [setSession]);

    return { session, hydrated, busy, lessonNotFound, send, retry, stop, reset, dismissLesson };
}
