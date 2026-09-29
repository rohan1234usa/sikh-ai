'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { isLessonSlug } from '@/lib/learn/config';
import {
    EMPTY_SESSION,
    MAX_TUTOR_REPLY_CHARS,
    TUTOR_SESSION_KEY,
    appendExchange,
    historyFor,
    parseTutorSession,
    settleReply,
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
// lesson starts a new conversation; the parameter is then dropped from the
// address, so a reload continues the conversation rather than restarting it.
export function useTutor() {
    const [session, setSession] = useState<TutorSession>(EMPTY_SESSION);
    const [hydrated, setHydrated] = useState(false);
    const [lessonNotFound, setLessonNotFound] = useState(false);
    const [busy, setBusy] = useState(false);
    const controllerRef = useRef<AbortController | null>(null);
    const sessionRef = useRef(session);

    useEffect(() => { sessionRef.current = session; }, [session]);

    useEffect(() => {
        let stored = EMPTY_SESSION;
        try {
            const raw = sessionStorage.getItem(TUTOR_SESSION_KEY);
            if (raw) stored = parseTutorSession(JSON.parse(raw));
        } catch { /* blocked or corrupt: start empty */ }

        // The address keeps its ?lesson= until the session holding the lesson
        // is saved (below), so running this twice, as development does,
        // reads the same thing both times.
        const requested = new URL(window.location.href).searchParams.get('lesson');
        let next = stored;
        if (requested !== null) {
            if (!isLessonSlug(requested)) setLessonNotFound(true);
            else if (requested !== stored.lesson) next = { lesson: requested, exchanges: [] };
        }
        setSession(next);
        setHydrated(true);
        return () => controllerRef.current?.abort();
    }, []);

    // Saved on every change, a streaming reply included, so a reload keeps
    // what had arrived.
    useEffect(() => {
        if (!hydrated) return;
        try {
            sessionStorage.setItem(TUTOR_SESSION_KEY, JSON.stringify(session));
        } catch { /* storage full or blocked: the conversation lasts for this page */ }
        // Saved, so the lesson no longer needs the address: a reload now
        // continues the conversation instead of starting it again.
        const url = new URL(window.location.href);
        if (url.searchParams.has('lesson')) {
            url.searchParams.delete('lesson');
            window.history.replaceState(window.history.state, '', url.pathname + url.search + url.hash);
        }
    }, [session, hydrated]);

    const setReply = useCallback((id: string, reply: TutorReply) => {
        setSession((s) => ({ ...s, exchanges: s.exchanges.map((e) => (e.id === id ? { ...e, reply } : e)) }));
    }, []);

    const stream = useCallback(async (id: string, message: string, history: HistoryTurn[], lesson: string | null) => {
        const controller = new AbortController();
        controllerRef.current = controller;
        setBusy(true);
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
                    text = (text + chunk).slice(0, MAX_TUTOR_REPLY_CHARS);
                    setReply(id, { text, status: 'streaming' });
                }
                outcome = { kind: 'closed' };
            }
        } catch {
            outcome = controller.signal.aborted ? { kind: 'aborted' } : { kind: 'failed' };
        }
        setReply(id, settleReply({ text, status: 'streaming' }, outcome));
        if (controllerRef.current === controller) {
            controllerRef.current = null;
            setBusy(false);
        }
    }, [setReply]);

    const send = useCallback((raw: string) => {
        const question = raw.trim();
        if (!question || controllerRef.current) return false;
        const { exchanges, lesson } = sessionRef.current;
        const id = crypto.randomUUID();
        const history = historyFor(exchanges);
        setSession((s) => ({ ...s, exchanges: appendExchange(s.exchanges, { id, question, reply: { text: '', status: 'streaming' } }) }));
        void stream(id, question, history, lesson);
        return true;
    }, [stream]);

    // Asks the last question again, after an error or a Stop before any text.
    const retry = useCallback(() => {
        const { exchanges, lesson } = sessionRef.current;
        const last = exchanges.at(-1);
        if (!last || controllerRef.current) return;
        setReply(last.id, { text: '', status: 'streaming' });
        void stream(last.id, last.question, historyFor(exchanges.slice(0, -1)), lesson);
    }, [setReply, stream]);

    const stop = useCallback(() => controllerRef.current?.abort(), []);

    // A new conversation, about the same lesson if there is one. A reply
    // still streaming is cut off and let go at once, so the input is ready
    // before the old request has finished unwinding.
    const reset = useCallback(() => {
        controllerRef.current?.abort();
        controllerRef.current = null;
        setBusy(false);
        setSession((s) => ({ lesson: s.lesson, exchanges: [] }));
    }, []);

    const dismissLesson = useCallback(() => setSession((s) => ({ ...s, lesson: null })), []);

    return { session, hydrated, busy, lessonNotFound, send, retry, stop, reset, dismissLesson };
}
