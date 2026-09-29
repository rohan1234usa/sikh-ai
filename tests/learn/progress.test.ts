import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
    EMPTY_PROGRESS,
    isLessonDone,
    isNewerProgress,
    lessonRecord,
    nextLesson,
    parseProgress,
    topicRecord,
    trackProgress,
    withCardReview,
    withLessonComplete,
    withTopicQuiz,
    withVisit,
    type LearnProgress,
} from '@/lib/learn/progress';
import { MAX_BOX, review } from '@/lib/learn/srs';

const NOW = Date.UTC(2026, 8, 28, 20, 0);
const SLUGS = ['one', 'two', 'three', 'four'];

function done(progress: LearnProgress, ...slugs: string[]): LearnProgress {
    return slugs.reduce((p, slug) => withLessonComplete(p, slug, { correct: 3, total: 5 }, NOW), progress);
}

test('anything unreadable gives empty progress', () => {
    for (const raw of [null, undefined, 'x', 42, [], { v: 2 }, { lessons: {} }]) {
        assert.deepEqual(parseProgress(raw), EMPTY_PROGRESS);
    }
});

test('progress saved by a newer version is recognized, so it is never written over', () => {
    assert.equal(isNewerProgress({ v: 2, lessons: {} }), true);
    assert.equal(isNewerProgress({ v: 1 }), false);
    assert.equal(isNewerProgress({ v: '2' }), false);
    assert.equal(isNewerProgress(null), false);
    assert.equal(isNewerProgress('v: 2'), false);
});

test('saved progress survives a round trip through JSON', () => {
    let progress = withVisit(EMPTY_PROGRESS, 'two', NOW);
    progress = withLessonComplete(progress, 'one', { correct: 4, total: 5 }, NOW);
    progress = withTopicQuiz(progress, 'family', { correct: 7, total: 10 }, NOW);
    progress = withCardReview(progress, 'family-chacha', true, NOW);
    assert.deepEqual(parseProgress(JSON.parse(JSON.stringify(progress))), progress);
});

test('a damaged record is dropped on its own and the rest kept', () => {
    const parsed = parseProgress({
        v: 1,
        updatedAt: 'yesterday',
        lessons: {
            good: { completedAt: NOW, best: { correct: 2, total: 3 }, attempts: 1 },
            'Bad Key': { completedAt: NOW, best: { correct: 2, total: 3 }, attempts: 1 },
            overscored: { completedAt: NOW, best: { correct: 4, total: 3 }, attempts: 1 },
            empty: { completedAt: NOW, best: { correct: 0, total: 0 }, attempts: 1 },
            unfinished: { best: { correct: 1, total: 3 }, attempts: 1 },
        },
        topics: { family: { lastAt: NOW, best: { correct: 1, total: 2 }, attempts: -1 } },
        cards: {
            'family-chacha': { box: 99, due: NOW, reviews: 3, lastAt: NOW },
            'family-mama': { box: -4.5, due: NOW, reviews: 1, lastAt: NOW },
            'family-masi': { box: 'high', due: NOW, reviews: 1, lastAt: NOW },
            'family-bhua': { box: 1, due: Infinity, reviews: 1, lastAt: NOW },
        },
        lastLesson: '../../etc',
    });
    assert.deepEqual(Object.keys(parsed.lessons), ['good']);
    assert.deepEqual(parsed.topics, {});
    assert.equal(parsed.cards['family-chacha'].box, MAX_BOX);
    assert.equal(parsed.cards['family-mama'].box, 0);
    assert.deepEqual(Object.keys(parsed.cards), ['family-chacha', 'family-mama']);
    assert.equal(parsed.lastLesson, null);
    assert.equal(parsed.updatedAt, 0);
});

test('opening a lesson makes it the last one, and opening it again changes nothing', () => {
    const visited = withVisit(EMPTY_PROGRESS, 'two', NOW);
    assert.equal(visited.lastLesson, 'two');
    assert.equal(withVisit(visited, 'two', NOW + 1), visited);
});

test('finishing a lesson again keeps its first completion and its best score, and counts the try', () => {
    let progress = withLessonComplete(EMPTY_PROGRESS, 'one', { correct: 4, total: 5 }, NOW);
    progress = withLessonComplete(progress, 'one', { correct: 2, total: 5 }, NOW + 1000);
    assert.deepEqual(lessonRecord(progress, 'one'), { completedAt: NOW, best: { correct: 4, total: 5 }, attempts: 2 });
    progress = withLessonComplete(progress, 'one', { correct: 5, total: 5 }, NOW + 2000);
    assert.deepEqual(lessonRecord(progress, 'one')?.best, { correct: 5, total: 5 });
    assert.ok(isLessonDone(progress, 'one'));
    assert.ok(!isLessonDone(progress, 'constructor'));
});

test('a topic quiz keeps the better score by share of right answers', () => {
    let progress = withTopicQuiz(EMPTY_PROGRESS, 'food', { correct: 8, total: 10 }, NOW);
    progress = withTopicQuiz(progress, 'food', { correct: 5, total: 6 }, NOW + 1);
    assert.deepEqual(topicRecord(progress, 'food'), { lastAt: NOW + 1, best: { correct: 5, total: 6 }, attempts: 2 });
});

test('reviewing a card follows the flashcard schedule', () => {
    const progress = withCardReview(withCardReview(EMPTY_PROGRESS, 'food-roti', true, NOW), 'food-roti', true, NOW + 1);
    assert.deepEqual(progress.cards['food-roti'], review(review(undefined, true, NOW), true, NOW + 1));
    assert.deepEqual(EMPTY_PROGRESS.cards, {}, 'the empty progress is never changed');
});

test('a track counts its finished lessons', () => {
    assert.deepEqual(trackProgress(done(EMPTY_PROGRESS, 'one', 'three', 'elsewhere'), SLUGS), { done: 2, total: 4 });
});

test('continue starts at the first lesson and goes back to one left unfinished', () => {
    assert.equal(nextLesson(EMPTY_PROGRESS, SLUGS), 'one');
    assert.equal(nextLesson(withVisit(EMPTY_PROGRESS, 'three', NOW), SLUGS), 'three');
});

test('continue moves past a finished lesson to the next unfinished one, wrapping round', () => {
    let progress = done(EMPTY_PROGRESS, 'two', 'three');
    assert.equal(nextLesson(withVisit(progress, 'two', NOW), SLUGS), 'four');
    progress = done(progress, 'four');
    assert.equal(nextLesson(withVisit(progress, 'four', NOW), SLUGS), 'one');
    assert.equal(nextLesson(done(progress, 'one'), SLUGS), null);
    assert.equal(nextLesson(withVisit(EMPTY_PROGRESS, 'gone', NOW), SLUGS), 'one', 'a lesson no longer listed is ignored');
    assert.equal(nextLesson(EMPTY_PROGRESS, []), null);
});
