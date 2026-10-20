// How long a lesson takes, from its own content: every word it puts on the
// page at about 200 a minute, and about 20 seconds a quiz question. The
// server works it out from the lesson's text (lessonPace) and hands a client
// component only the seconds, never the text; the rest is arithmetic either
// side can do.

import type { LessonBody, LessonSection } from './config';

export const WORDS_PER_MINUTE = 200;
export const SECONDS_PER_QUESTION = 20;

// A lesson's time in whole seconds: each section's, in order, then its quiz's.
export type LessonPace = { sections: number[]; quiz: number };

const words = (text: string | undefined): number => (text ? text.split(/\s+/).filter(Boolean).length : 0);

// Every word a section shows: its heading, paragraphs and tip, each letter's
// glyph, name, sound and romanization, and each example in all three
// renditions with its note.
export function sectionWords(section: LessonSection): number {
    let count = words(section.heading) + words(section.tip);
    for (const paragraph of section.body) count += words(paragraph);
    for (const letter of section.letters ?? []) {
        count += words(letter.glyph) + words(letter.name) + words(letter.roman) + words(letter.sound);
    }
    for (const example of section.examples ?? []) {
        count += words(example.gurmukhi) + words(example.roman) + words(example.english) + words(example.note);
    }
    return count;
}

export function lessonPace(lesson: LessonBody): LessonPace {
    return {
        sections: lesson.sections.map((section) => Math.round((sectionWords(section) * 60) / WORDS_PER_MINUTE)),
        quiz: lesson.quiz.length * SECONDS_PER_QUESTION,
    };
}

// What is left from a checkpoint (lib/learn/progress.ts) to the end: from
// the first section, the whole lesson; from the quiz, the quiz alone.
export function secondsFrom(pace: LessonPace, checkpoint = 0): number {
    return pace.sections.slice(Math.max(0, checkpoint)).reduce((sum, seconds) => sum + seconds, 0) + pace.quiz;
}

// Seconds as the whole minutes "about n min" says: rounded, and never 0.
export function minutes(seconds: number): number {
    return Math.max(1, Math.round(seconds / 60));
}

// A section's own time for the outline: whole minutes, or null when it is
// under 45 seconds. Rounding each short section up to a minute would make
// the rows add up to more than the lesson's total.
export function sectionMinutes(seconds: number): number | null {
    return seconds < 45 ? null : minutes(seconds);
}
