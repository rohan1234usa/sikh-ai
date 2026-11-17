// What the /learn hub says about the next step and each track: pure, so the
// tests read it against the English dictionary.

import type { Dictionary } from '@/lib/i18n';
import { fmt } from '@/lib/i18n/fmt';
import { isLessonTrack, type TrackId } from './config';
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

// What a track's cell says: its first milestone while its count is short of
// it, then the count, with the share of the track done (0 to 1) for its gold
// rule. Lessons done only grow; words learned can fall after a miss, and the
// cell then shows the milestone again. A milestone that stays reached needs
// progress to remember it, which #66's step 3 can add with its new fields.
export type TrackLine =
    | { kind: 'milestone'; text: string }
    | { kind: 'count'; text: string; fill: number };

// Null for the tutor, which has nothing to count, and before progress is
// read (the cell keeps the line's place). A word is learned while it is in
// the week-long box or above, as on the topic pages.
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

// Where a track fits, in a line beside its icon, until a lesson track is
// finished: "Start here" over a finished script track would contradict the
// Today panel. Null then, and the cell keeps the line's place. Before
// progress is read (`facts` null) every line shows, as the page is built.
// Every learner gets the default order (for those who grew up hearing
// Punjabi) until the starting-point chooser (#66, step 3) adds a set per
// starting point beside it, and the starting point here.
export function orderLine(t: Dictionary, id: TrackId, facts: TrackFacts | null): string | null {
    if (isLessonTrack(id) && facts !== null && facts.total > 0 && facts.done >= facts.total) return null;
    return t.learn.hub.order.default[id];
}
