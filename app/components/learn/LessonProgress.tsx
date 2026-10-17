'use client';

import { createContext, useContext, useEffect, useRef, type ReactNode } from 'react';
import { QUIZ_ANCHOR, sectionAnchor } from '@/lib/learn/config';
import { checkpointReached, isLessonDone } from '@/lib/learn/progress';
import { useLearnProgress } from './useLearnProgress';

type LessonProgressValue = ReturnType<typeof useLearnProgress>;

const LessonProgressContext = createContext<LessonProgressValue | null>(null);

// The lesson page's share of the learner's progress, for its parts (the quiz).
export function useLessonProgress(): LessonProgressValue {
    const value = useContext(LessonProgressContext);
    if (!value) throw new Error('useLessonProgress needs a LessonProgress around it');
    return value;
}

// A checkpoint counts as reached once its heading comes this far up the
// screen, or is on screen at all when the page can scroll no further.
const READING_LINE = 0.4;

// The furthest checkpoint reached on screen now, or -1 for none: a section's
// heading, then the quiz's. Measured rather than observed, so a jump (End,
// a link to the quiz) counts the checkpoints it passes.
function furthestOnScreen(sections: number): number {
    const line = window.innerHeight * READING_LINE;
    const atFoot = window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 2;
    let furthest = -1;
    for (let checkpoint = 0; checkpoint <= sections; checkpoint++) {
        const heading = document.getElementById(checkpoint < sections ? sectionAnchor(checkpoint) : QUIZ_ANCHOR);
        if (!heading) continue;
        const top = heading.getBoundingClientRect().top;
        if (top <= line || (atFoot && top < window.innerHeight)) furthest = checkpoint;
    }
    return furthest;
}

// Around a lesson page: the one island that reads this browser's progress,
// shared with the page's parts. Opening the lesson makes it the one the
// hub's "Continue" returns to, and each section read past is saved as a
// checkpoint, so "Continue" reopens the lesson there.
//
// Across the top, under the navbar, a thin gold rule (Pothi's rule for
// progress) fills as checkpoints are passed: a share for each section and
// one for the quiz, and the whole once the lesson is done. The fill is a
// border, so forced colours keep it; the track is a background, so they
// drop it. It only pictures what the hub and the track list say in words.
export default function LessonProgress({ slug, sections, children }: {
    slug: string;
    sections: number; // the lesson's section count; its quiz is the checkpoint after them
    children: ReactNode;
}) {
    const learn = useLearnProgress();
    const { progress, hydrated, visitLesson, reachCheckpoint } = learn;

    useEffect(() => {
        if (hydrated) visitLesson(slug);
    }, [hydrated, slug, visitLesson]);

    // The furthest checkpoint saved, so scrolling writes only a new one. It
    // follows the saved copy down too: after a reset in another tab, the
    // next scroll saves this page's place again.
    const furthest = useRef(-1);
    const saved = hydrated ? checkpointReached(progress, slug) ?? -1 : -1;
    useEffect(() => {
        furthest.current = saved;
    }, [saved]);

    useEffect(() => {
        if (!hydrated) return;
        let frame = 0;
        const measure = () => {
            frame = 0;
            const reached = furthestOnScreen(sections);
            if (reached > furthest.current) {
                furthest.current = reached;
                reachCheckpoint(slug, reached);
            }
        };
        const schedule = () => {
            if (!frame) frame = requestAnimationFrame(measure);
        };
        schedule();
        window.addEventListener('scroll', schedule, { passive: true });
        window.addEventListener('resize', schedule);
        return () => {
            window.removeEventListener('scroll', schedule);
            window.removeEventListener('resize', schedule);
            cancelAnimationFrame(frame);
        };
    }, [hydrated, slug, sections, reachCheckpoint]);

    const passed = hydrated && isLessonDone(progress, slug) ? 1 : Math.max(0, saved) / (sections + 1);

    return (
        <LessonProgressContext.Provider value={learn}>
            {/* A sliver of ground above it keeps it apart from the navbar's band. */}
            <div aria-hidden="true" className="sticky top-16 z-40 mx-auto w-full max-w-3xl bg-surface px-6 pt-1">
                <div className="h-0.5 bg-edge">
                    <div className="h-0.5 border-t-2 border-rule-gold" style={{ width: `${passed * 100}%` }} />
                </div>
            </div>
            {children}
        </LessonProgressContext.Provider>
    );
}
