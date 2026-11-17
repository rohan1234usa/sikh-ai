import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
    EMPTY_PROGRESS,
    PROGRESS_VERSION,
    checkpointReached,
    isLessonDone,
    isNewerProgress,
    lessonPlace,
    lessonRecord,
    nextLesson,
    parseProgress,
    placeHash,
    topicRecord,
    trackProgress,
    withCardReview,
    withCheckpoint,
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
    for (const raw of [null, undefined, 'x', 42, [], { v: 0 }, { v: 3 }, { v: '2' }, { lessons: {} }]) {
        assert.deepEqual(parseProgress(raw), EMPTY_PROGRESS);
    }
});

test('progress saved by a newer version is recognized, so it is never written over', () => {
    assert.equal(PROGRESS_VERSION, 2);
    assert.equal(isNewerProgress({ v: 3, lessons: {} }), true);
    assert.equal(isNewerProgress({ v: 2 }), false);
    assert.equal(isNewerProgress({ v: 1 }), false);
    assert.equal(isNewerProgress({ v: '3' }), false);
    assert.equal(isNewerProgress(null), false);
    assert.equal(isNewerProgress('v: 3'), false);
});

test('saved progress survives a round trip through JSON', () => {
    let progress = withVisit(EMPTY_PROGRESS, 'two', NOW);
    progress = withLessonComplete(progress, 'one', { correct: 4, total: 5 }, NOW);
    progress = withTopicQuiz(progress, 'family', { correct: 7, total: 10 }, NOW);
    progress = withCardReview(progress, 'family-chacha', true, NOW);
    progress = withCheckpoint(progress, 'two', 0, NOW);
    progress = withCheckpoint(progress, 'three', 2, NOW);
    assert.deepEqual(parseProgress(JSON.parse(JSON.stringify(progress))), progress);
});

test('progress saved before checkpoints keeps everything, and starts every lesson from its top', () => {
    const v1 = {
        v: 1,
        updatedAt: NOW,
        lessons: { one: { completedAt: NOW, best: { correct: 4, total: 5 }, attempts: 2 } },
        topics: { family: { lastAt: NOW, best: { correct: 7, total: 10 }, attempts: 1 } },
        cards: { 'family-chacha': { box: 2, due: NOW, reviews: 3, lastAt: NOW } },
        lastLesson: 'two',
        reached: { two: 3 }, // not a version 1 field: ignored
    };
    const parsed = parseProgress(JSON.parse(JSON.stringify(v1)));
    assert.equal(parsed.v, PROGRESS_VERSION);
    assert.deepEqual(
        { lessons: parsed.lessons, topics: parsed.topics, cards: parsed.cards, lastLesson: parsed.lastLesson, updatedAt: parsed.updatedAt },
        { lessons: v1.lessons, topics: v1.topics, cards: v1.cards, lastLesson: 'two', updatedAt: NOW },
    );
    assert.deepEqual(parsed.reached, {});
    assert.equal(lessonPlace(parsed, 'two', 4).kind, 'new');
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

test('a damaged checkpoint is dropped on its own, and the first section counts', () => {
    const parsed = parseProgress({
        v: 2,
        reached: { first: 0, third: 2, quiz: 4, minus: -1, half: 1.5, word: '2', huge: 1000, 'Bad Key': 1 },
    });
    assert.deepEqual(parsed.reached, { first: 0, third: 2, quiz: 4 });
    assert.equal(checkpointReached(parsed, 'first'), 0);
    assert.equal(checkpointReached(parsed, 'constructor'), undefined);
});

test('reading on keeps the furthest checkpoint, and reading back changes nothing', () => {
    const at2 = withCheckpoint(EMPTY_PROGRESS, 'one', 2, NOW);
    assert.equal(checkpointReached(at2, 'one'), 2);
    assert.equal(at2.updatedAt, NOW);
    assert.equal(withCheckpoint(at2, 'one', 1, NOW + 1), at2, 'an earlier section');
    assert.equal(withCheckpoint(at2, 'one', 2, NOW + 1), at2, 'the same section');
    assert.equal(checkpointReached(withCheckpoint(at2, 'one', 4, NOW + 1), 'one'), 4);
    for (const junk of [-1, 1.5, Number.NaN, Infinity, 100]) {
        assert.equal(withCheckpoint(EMPTY_PROGRESS, 'one', junk, NOW), EMPTY_PROGRESS, String(junk));
    }
    assert.deepEqual(EMPTY_PROGRESS.reached, {}, 'the empty progress is never changed');
});

test('a lesson is new, at a section, at its quiz or done, and reopens where it was left', () => {
    let progress: LearnProgress = EMPTY_PROGRESS;
    assert.deepEqual(lessonPlace(progress, 'one', 4), { kind: 'new' });
    progress = withCheckpoint(progress, 'one', 0, NOW);
    assert.deepEqual(lessonPlace(progress, 'one', 4), { kind: 'section', index: 0 });
    assert.equal(placeHash(lessonPlace(progress, 'one', 4)), '', 'the first section is the top of the page');
    progress = withCheckpoint(progress, 'one', 2, NOW);
    assert.deepEqual(lessonPlace(progress, 'one', 4), { kind: 'section', index: 2 });
    assert.equal(placeHash(lessonPlace(progress, 'one', 4)), '#section-3', 'anchors count from 1');
    progress = withCheckpoint(progress, 'one', 4, NOW);
    assert.deepEqual(lessonPlace(progress, 'one', 4), { kind: 'quiz' });
    assert.equal(placeHash(lessonPlace(progress, 'one', 4)), '#lesson-quiz');
    assert.deepEqual(lessonPlace(progress, 'one', 3), { kind: 'quiz' }, 'a lesson that lost a section');
    progress = done(progress, 'one');
    assert.deepEqual(lessonPlace(progress, 'one', 4), { kind: 'done' });
    assert.equal(placeHash(lessonPlace(progress, 'one', 4)), '', 'a finished lesson opens at its top');
    assert.equal(placeHash({ kind: 'new' }), '');
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
