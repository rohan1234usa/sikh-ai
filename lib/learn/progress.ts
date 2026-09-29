// What Learn Punjabi remembers about a learner: finished lessons and their
// best quiz score, each vocabulary topic's best quiz score, every
// flashcard's schedule, and the lesson opened last. It is kept in the
// browser (app/components/learn/useLearnProgress.ts); these are its pure
// rules.
//
// Saved data comes back through parseProgress, which never throws and keeps
// every record it can vouch for. A later change of shape bumps `v` and
// migrates the old one inside parseProgress, and a page from before the
// change leaves the newer shape alone (isNewerProgress), so progress is never
// dropped just because the format moved on.

import type { QuizScore } from './quiz';
import { MAX_BOX, cardOf, review, type CardState } from './srs';

export const PROGRESS_VERSION = 1;

export type LessonRecord = { completedAt: number; best: QuizScore; attempts: number };
export type TopicRecord = { lastAt: number; best: QuizScore; attempts: number };

export type LearnProgress = {
    v: typeof PROGRESS_VERSION;
    updatedAt: number;
    lessons: Record<string, LessonRecord>; // by lesson slug
    topics: Record<string, TopicRecord>;   // by vocabulary topic id
    cards: Record<string, CardState>;      // by word id
    lastLesson: string | null;             // the slug opened last
};

export const EMPTY_PROGRESS: LearnProgress = Object.freeze({
    v: PROGRESS_VERSION,
    updatedAt: 0,
    lessons: Object.freeze({}),
    topics: Object.freeze({}),
    cards: Object.freeze({}),
    lastLesson: null,
}) as LearnProgress;

// Slugs, topic ids and word ids are all lowercase, digits and hyphens.
const KEY = /^[a-z0-9-]{1,80}$/;

type Obj = Record<string, unknown>;
const isObject = (value: unknown): value is Obj => typeof value === 'object' && value !== null && !Array.isArray(value);
const isTime = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value) && value >= 0;
const isCount = (value: unknown): value is number => Number.isInteger(value) && (value as number) >= 0;

function own<T>(record: Readonly<Record<string, T>>, key: string): T | undefined {
    return Object.prototype.hasOwnProperty.call(record, key) ? record[key] : undefined;
}

function parseScore(raw: unknown): QuizScore | null {
    if (!isObject(raw) || !isCount(raw.correct) || !isCount(raw.total)) return null;
    if (raw.total < 1 || raw.correct > raw.total) return null;
    return { correct: raw.correct, total: raw.total };
}

function parseLesson(raw: unknown): LessonRecord | null {
    if (!isObject(raw) || !isTime(raw.completedAt) || !isCount(raw.attempts)) return null;
    const best = parseScore(raw.best);
    return best ? { completedAt: raw.completedAt, best, attempts: raw.attempts } : null;
}

function parseTopic(raw: unknown): TopicRecord | null {
    if (!isObject(raw) || !isTime(raw.lastAt) || !isCount(raw.attempts)) return null;
    const best = parseScore(raw.best);
    return best ? { lastAt: raw.lastAt, best, attempts: raw.attempts } : null;
}

function parseCard(raw: unknown): CardState | null {
    if (!isObject(raw) || typeof raw.box !== 'number' || !Number.isFinite(raw.box)) return null;
    if (!isTime(raw.due) || !isCount(raw.reviews) || !isTime(raw.lastAt)) return null;
    return { box: Math.min(MAX_BOX, Math.max(0, Math.floor(raw.box))), due: raw.due, reviews: raw.reviews, lastAt: raw.lastAt };
}

function records<T>(raw: unknown, parse: (value: unknown) => T | null): Record<string, T> {
    const out: Record<string, T> = {};
    if (!isObject(raw)) return out;
    for (const [key, value] of Object.entries(raw)) {
        if (!KEY.test(key)) continue;
        const parsed = parse(value);
        if (parsed) out[key] = parsed;
    }
    return out;
}

// Anything at all in, a usable LearnProgress out: junk or another version
// gives the empty one, and a damaged record is dropped on its own.
// Saved by a newer version of the site than this page: it can't be read
// here, and it must not be written over.
export function isNewerProgress(raw: unknown): boolean {
    return isObject(raw) && typeof raw.v === 'number' && raw.v > PROGRESS_VERSION;
}

export function parseProgress(raw: unknown): LearnProgress {
    if (!isObject(raw) || raw.v !== PROGRESS_VERSION) return EMPTY_PROGRESS;
    return {
        v: PROGRESS_VERSION,
        updatedAt: isTime(raw.updatedAt) ? raw.updatedAt : 0,
        lessons: records(raw.lessons, parseLesson),
        topics: records(raw.topics, parseTopic),
        cards: records(raw.cards, parseCard),
        lastLesson: typeof raw.lastLesson === 'string' && KEY.test(raw.lastLesson) ? raw.lastLesson : null,
    };
}

// The higher share of right answers; a tie keeps the one already there.
function better(kept: QuizScore | undefined, next: QuizScore): QuizScore {
    if (!kept) return next;
    return kept.correct * next.total >= next.correct * kept.total ? kept : next;
}

export function isLessonDone(progress: LearnProgress, slug: string): boolean {
    return own(progress.lessons, slug) !== undefined;
}

export function lessonRecord(progress: LearnProgress, slug: string): LessonRecord | undefined {
    return own(progress.lessons, slug);
}

export function topicRecord(progress: LearnProgress, topic: string): TopicRecord | undefined {
    return own(progress.topics, topic);
}

// Opening a lesson makes it the one "Continue" goes back to.
export function withVisit(progress: LearnProgress, slug: string, now: number): LearnProgress {
    if (progress.lastLesson === slug) return progress;
    return { ...progress, lastLesson: slug, updatedAt: now };
}

// Checking a lesson's quiz completes the lesson, whatever the score: the
// first completion's time stays, the best score is kept, and every try counts.
export function withLessonComplete(progress: LearnProgress, slug: string, score: QuizScore, now: number): LearnProgress {
    const kept = own(progress.lessons, slug);
    return {
        ...progress,
        updatedAt: now,
        lastLesson: slug,
        lessons: {
            ...progress.lessons,
            [slug]: {
                completedAt: kept?.completedAt ?? now,
                best: better(kept?.best, score),
                attempts: (kept?.attempts ?? 0) + 1,
            },
        },
    };
}

export function withTopicQuiz(progress: LearnProgress, topic: string, score: QuizScore, now: number): LearnProgress {
    const kept = own(progress.topics, topic);
    return {
        ...progress,
        updatedAt: now,
        topics: {
            ...progress.topics,
            [topic]: { lastAt: now, best: better(kept?.best, score), attempts: (kept?.attempts ?? 0) + 1 },
        },
    };
}

export function withCardReview(progress: LearnProgress, wordId: string, correct: boolean, now: number): LearnProgress {
    return {
        ...progress,
        updatedAt: now,
        cards: { ...progress.cards, [wordId]: review(cardOf(progress.cards, wordId), correct, now) },
    };
}

export function trackProgress(progress: LearnProgress, slugs: readonly string[]): { done: number; total: number } {
    return { done: slugs.filter((slug) => isLessonDone(progress, slug)).length, total: slugs.length };
}

// Where "Continue" leads: the lesson opened last if it isn't finished, else
// the next unfinished one after it in `slugs` (wrapping round to the start),
// else null once every lesson is done. With nothing opened yet, the first
// unfinished lesson.
export function nextLesson(progress: LearnProgress, slugs: readonly string[]): string | null {
    const open = (slug: string) => !isLessonDone(progress, slug);
    const last = progress.lastLesson === null ? -1 : slugs.indexOf(progress.lastLesson);
    if (last !== -1 && open(slugs[last])) return slugs[last];
    for (let step = 1; step <= slugs.length; step++) {
        const slug = slugs[(last + step) % slugs.length];
        if (open(slug)) return slug;
    }
    return null;
}
