// What the /learn hub says about the next step and each track: pure, so the
// tests read it against the English dictionary.

import type { Dictionary } from '@/lib/i18n';
import { fmt } from '@/lib/i18n/fmt';
import type { TrackId } from './config';
import { isLessonDone, type LearnProgress, type LessonPlace } from './progress';

// What the Today panel calls the next lesson (t.learn.hub[kind]).
export type StepKind = 'continue' | 'upNext' | 'start';

// A lesson read partway, or the one opened last, is continued, even when
// another was opened since; otherwise it is up next once any lesson is done,
// and where to start before that.
export function stepKind(progress: LearnProgress, next: string, place: LessonPlace, slugs: readonly string[]): StepKind {
    if (next === progress.lastLesson || place.kind === 'section' || place.kind === 'quiz') return 'continue';
    return slugs.some((slug) => isLessonDone(progress, slug)) ? 'upNext' : 'start';
}

// Words to learn before the vocabulary track shows its count.
export const FIRST_WORDS = 10;

// How far a track has come: lessons done, or words learned.
export type TrackFacts = { done: number; total: number };

// What a track's cell says: a first milestone until it is reached, then the
// count, with the share of the track done (0 to 1) for its gold rule.
export type TrackLine =
    | { kind: 'milestone'; text: string }
    | { kind: 'count'; text: string; fill: number };

// Null for the tutor, which has nothing to count, and before progress is
// read (the cell keeps the line's place). A word is learned once it has
// earned the week-long box, as on the topic pages.
export function trackLine(t: Dictionary, id: TrackId, facts: TrackFacts | null): TrackLine | null {
    if (id === 'tutor' || facts === null) return null;
    const { done, total } = facts;
    const fill = total > 0 ? Math.min(1, done / total) : 0;
    if (id === 'vocab') {
        return done < FIRST_WORDS
            ? { kind: 'milestone', text: fmt(t.learn.hub.milestones.vocab, { n: FIRST_WORDS }) }
            : { kind: 'count', text: fmt(t.learn.hub.wordsLearned, { n: done, total }), fill };
    }
    return done === 0
        ? { kind: 'milestone', text: t.learn.hub.milestones[id] }
        : { kind: 'count', text: fmt(t.learn.hub.lessonsDone, { done, total }), fill };
}
