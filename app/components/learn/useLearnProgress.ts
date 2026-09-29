'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import {
    EMPTY_PROGRESS,
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
// hydrated (the server renders no progress), writes each change back, and
// follows other tabs. One island per page uses it.
const STORAGE_KEY = 'sikhai.learn.progress.v1'; // the suffix names the storage generation

function read(): LearnProgress {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        return raw ? parseProgress(JSON.parse(raw)) : EMPTY_PROGRESS;
    } catch {
        return EMPTY_PROGRESS; // corrupt JSON or storage blocked: start empty
    }
}

export function useLearnProgress() {
    const [progress, setProgress] = useState<LearnProgress>(EMPTY_PROGRESS);
    // When the saved copy was read, or null before then. Render reads the
    // clock only through this, so it stays pure.
    const [loadedAt, setLoadedAt] = useState<number | null>(null);
    // The progress last read or written, so the save effect never writes back
    // what it just read.
    const savedRef = useRef<LearnProgress | null>(null);

    useEffect(() => {
        const load = () => {
            const loaded = read();
            savedRef.current = loaded;
            setProgress(loaded);
            setLoadedAt(Date.now());
        };
        load();
        // Another tab finished a lesson or reset: show what it saved.
        const onStorage = (event: StorageEvent) => {
            if (event.key === null || event.key === STORAGE_KEY) load();
        };
        window.addEventListener('storage', onStorage);
        return () => window.removeEventListener('storage', onStorage);
    }, []);

    useEffect(() => {
        if (loadedAt === null || savedRef.current === progress) return;
        savedRef.current = progress;
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(progress));
        } catch { /* storage full or blocked: progress lasts for this visit */ }
    }, [progress, loadedAt]);

    // The time is read outside each updater, so React running an updater
    // twice (as it does in development) records the same thing twice.
    const visitLesson = useCallback((slug: string) => {
        const now = Date.now();
        setProgress((p) => withVisit(p, slug, now));
    }, []);

    const completeLesson = useCallback((slug: string, score: QuizScore) => {
        const now = Date.now();
        setProgress((p) => withLessonComplete(p, slug, score, now));
    }, []);

    const recordTopicQuiz = useCallback((topic: string, score: QuizScore) => {
        const now = Date.now();
        setProgress((p) => withTopicQuiz(p, topic, score, now));
    }, []);

    const reviewCard = useCallback((wordId: string, correct: boolean) => {
        const now = Date.now();
        setProgress((p) => withCardReview(p, wordId, correct, now));
    }, []);

    const reset = useCallback(() => {
        try { localStorage.removeItem(STORAGE_KEY); } catch { /* ignore */ }
        // Marked as saved first, so the effect doesn't write the key back.
        savedRef.current = EMPTY_PROGRESS;
        setProgress(EMPTY_PROGRESS);
    }, []);

    return {
        progress,
        hydrated: loadedAt !== null,
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
