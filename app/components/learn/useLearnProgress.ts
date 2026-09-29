'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import {
    EMPTY_PROGRESS,
    isNewerProgress,
    parseProgress,
    withCardReview,
    withLessonComplete,
    withTopicQuiz,
    withVisit,
    type LearnProgress,
} from '@/lib/learn/progress';
import type { QuizScore } from '@/lib/learn/quiz';

// Learn Punjabi's progress, kept in this browser only. The rules live in
// lib/learn/progress.ts; this hook reads the saved copy once the page has
// hydrated (the server renders no progress) and follows other tabs. One
// island per page uses it.
//
// Each change is made to the saved copy as it is at that moment, not to this
// page's copy of it, so a page that missed another tab's writes (one restored
// by Back, say) can't write over them. Progress saved by a newer version of
// the site is left alone. When storage is blocked or full, or holds that
// newer progress, changes last for this page only.
const STORAGE_KEY = 'sikhai.learn.progress.v1'; // the suffix names the storage generation

type Saved = { progress: LearnProgress; writable: boolean };

function readSaved(): Saved {
    let raw: string | null;
    try {
        raw = localStorage.getItem(STORAGE_KEY);
    } catch {
        return { progress: EMPTY_PROGRESS, writable: false }; // storage blocked
    }
    if (!raw) return { progress: EMPTY_PROGRESS, writable: true };
    let data: unknown;
    try {
        data = JSON.parse(raw);
    } catch {
        return { progress: EMPTY_PROGRESS, writable: true }; // corrupt: start again
    }
    if (isNewerProgress(data)) return { progress: EMPTY_PROGRESS, writable: false };
    return { progress: parseProgress(data), writable: true };
}

export function useLearnProgress() {
    const [progress, setProgress] = useState<LearnProgress>(EMPTY_PROGRESS);
    // When the saved copy was read, or null before then. Render reads the
    // clock only through this, so it stays pure.
    const [loadedAt, setLoadedAt] = useState<number | null>(null);
    // Set when the saved copy can't be written: changes then stay in the page.
    const memoryOnly = useRef(false);

    useEffect(() => {
        const load = () => {
            const saved = readSaved();
            memoryOnly.current = !saved.writable;
            setProgress(saved.progress);
            setLoadedAt(Date.now());
        };
        load();
        // Another tab finished a lesson or reset: show what it saved.
        const onStorage = (event: StorageEvent) => {
            if (event.key === null || event.key === STORAGE_KEY) load();
        };
        // A page restored by Back or Forward may have missed those events.
        // One that couldn't save keeps what it holds instead.
        const onShow = (event: PageTransitionEvent) => {
            if (event.persisted && !memoryOnly.current) load();
        };
        window.addEventListener('storage', onStorage);
        window.addEventListener('pageshow', onShow);
        return () => {
            window.removeEventListener('storage', onStorage);
            window.removeEventListener('pageshow', onShow);
        };
    }, []);

    const change = useCallback((apply: (progress: LearnProgress) => LearnProgress) => {
        if (!memoryOnly.current) {
            const saved = readSaved();
            if (saved.writable) {
                const next = apply(saved.progress);
                try {
                    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
                    setProgress(next);
                    return;
                } catch { /* storage full: this visit only, from now on */ }
            }
            memoryOnly.current = true;
        }
        setProgress(apply);
    }, []);

    // The time is read outside each change, so React running an updater
    // twice (as it does in development) records the same thing twice.
    const visitLesson = useCallback((slug: string) => {
        const now = Date.now();
        change((p) => withVisit(p, slug, now));
    }, [change]);

    const completeLesson = useCallback((slug: string, score: QuizScore) => {
        const now = Date.now();
        change((p) => withLessonComplete(p, slug, score, now));
    }, [change]);

    const recordTopicQuiz = useCallback((topic: string, score: QuizScore) => {
        const now = Date.now();
        change((p) => withTopicQuiz(p, topic, score, now));
    }, [change]);

    const reviewCard = useCallback((wordId: string, correct: boolean) => {
        const now = Date.now();
        change((p) => withCardReview(p, wordId, correct, now));
    }, [change]);

    const reset = useCallback(() => {
        try {
            // Progress saved by a newer version of the site isn't this page's
            // to clear: only what this page shows is reset.
            if (readSaved().writable) {
                localStorage.removeItem(STORAGE_KEY);
                memoryOnly.current = false;
            }
        } catch { /* storage blocked: nothing was saved */ }
        setProgress(EMPTY_PROGRESS);
    }, []);

    return {
        progress,
        hydrated: loadedAt !== null,
        // When the saved copy was last read: it changes when another tab or
        // a restored page brings a new copy, never for this page's changes.
        loadedAt,
        // What due flashcards are counted against: the later of the read and
        // the last change, so a card just missed counts as due at once.
        now: loadedAt === null ? null : Math.max(loadedAt, progress.updatedAt),
        visitLesson,
        completeLesson,
        recordTopicQuiz,
        reviewCard,
        reset,
    };
}
