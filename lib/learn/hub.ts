// What the /learn hub says about the next step and each track: pure, so the
// tests read it against the English dictionary.

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
