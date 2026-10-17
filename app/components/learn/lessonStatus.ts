import type { Dictionary } from '@/lib/i18n';
import { fmt } from '@/lib/i18n/fmt';
import { minutes, secondsFrom, type LessonPace } from '@/lib/learn/pace';
import type { LessonPlace } from '@/lib/learn/progress';

// A lesson's place and time in words, for the hub and the track list.

// Where the learner is in it, once started and until done.
export function placeWords(t: Dictionary, place: LessonPlace, pace: LessonPace): string | null {
    if (place.kind === 'section') return fmt(t.learn.lesson.sectionOf, { n: place.index + 1, total: pace.sections.length });
    if (place.kind === 'quiz') return t.learn.lesson.atQuiz;
    return null;
}

// How long it takes: what is left once started, the whole lesson otherwise.
export function timeWords(t: Dictionary, place: LessonPlace, pace: LessonPace): string {
    if (place.kind === 'section' || place.kind === 'quiz') {
        const from = place.kind === 'section' ? place.index : pace.sections.length;
        return fmt(t.learn.lesson.minutesLeft, { n: minutes(secondsFrom(pace, from)) });
    }
    return fmt(t.learn.lesson.minutes, { n: minutes(secondsFrom(pace)) });
}
