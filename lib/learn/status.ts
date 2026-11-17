// Learn's progress in words: a lesson's place and time, for the hub and the
// track list (where the learner is in it, lib/learn/progress.ts, and how long
// it or the rest of it takes, lib/learn/pace.ts), and the flashcards due, for
// the hub and the vocabulary page.

import type { LearnCopy } from '@/lib/i18n/learn';
import { fmt } from '@/lib/i18n/fmt';
import { minutes, secondsFrom, type LessonPace } from './pace';
import type { LessonPlace } from './progress';

// Where the learner is in it, once started and until done.
export function placeWords(learn: LearnCopy, place: LessonPlace, pace: LessonPace): string | null {
    if (place.kind === 'section') return fmt(learn.lesson.sectionOf, { n: place.index + 1, total: pace.sections.length });
    if (place.kind === 'quiz') return learn.lesson.atQuiz;
    return null;
}

// How long it takes: what is left once started, the whole lesson otherwise.
export function timeWords(learn: LearnCopy, place: LessonPlace, pace: LessonPace): string {
    if (place.kind === 'section' || place.kind === 'quiz') {
        const from = place.kind === 'section' ? place.index : pace.sections.length;
        return fmt(learn.lesson.minutesLeft, { n: minutes(secondsFrom(pace, from)) });
    }
    return fmt(learn.lesson.minutes, { n: minutes(secondsFrom(pace)) });
}

// The way into a review of every card due (/learn/review), or null when none
// is. Two strings, since fmt has no plurals.
export function reviewLabel(learn: LearnCopy, due: number): string | null {
    if (due <= 0) return null;
    return due === 1 ? learn.review.dueOne : fmt(learn.review.dueMany, { n: due });
}
