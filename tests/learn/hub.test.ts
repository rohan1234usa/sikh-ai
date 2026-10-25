import { test } from 'node:test';
import assert from 'node:assert/strict';
import en from '@/lib/i18n/dictionaries/en';
import { TRACK_IDS } from '@/lib/learn/config';
import { FIRST_WORDS, orderLine, stepKind, trackLine } from '@/lib/learn/hub';
import { EMPTY_PROGRESS, withCheckpoint, withLessonComplete, withVisit } from '@/lib/learn/progress';

const NOW = Date.UTC(2026, 9, 24, 20, 0);
const SLUGS = ['one', 'two', 'three'];
const SCORE = { correct: 5, total: 7 };

test('the Today panel starts a new learner, then says what is up next', () => {
    assert.equal(stepKind(EMPTY_PROGRESS, 'one', { kind: 'new' }, SLUGS), 'start');
    // Finishing lesson one makes it the lesson opened last, so two is up next.
    const after = withLessonComplete(EMPTY_PROGRESS, 'one', SCORE, NOW);
    assert.equal(stepKind(after, 'two', { kind: 'new' }, SLUGS), 'upNext');
});

test('a lesson opened last, or read partway, is continued even when another was opened since', () => {
    const opened = withVisit(EMPTY_PROGRESS, 'two', NOW);
    assert.equal(stepKind(opened, 'two', { kind: 'new' }, SLUGS), 'continue');
    const partway = withVisit(withCheckpoint(EMPTY_PROGRESS, 'two', 1, NOW), 'three', NOW);
    assert.equal(stepKind(partway, 'two', { kind: 'section', index: 1 }, SLUGS), 'continue');
    assert.equal(stepKind(partway, 'two', { kind: 'quiz' }, SLUGS), 'continue');
});

test('a lesson track shows its first milestone until a lesson is done, then the count and its share', () => {
    assert.deepEqual(trackLine(en, 'script', { done: 0, total: 9 }), { kind: 'milestone', text: 'Read your first word' });
    assert.deepEqual(trackLine(en, 'script', { done: 1, total: 9 }), { kind: 'count', text: 'Lessons done: 1 of 9', fill: 1 / 9 });
    assert.deepEqual(trackLine(en, 'grammar', { done: 0, total: 12 }), { kind: 'milestone', text: 'Make your first sentence' });
    assert.deepEqual(trackLine(en, 'grammar', { done: 12, total: 12 }), { kind: 'count', text: 'Lessons done: 12 of 12', fill: 1 });
});

test('vocabulary shows its first milestone until ten words are learned', () => {
    assert.equal(FIRST_WORDS, 10);
    for (const done of [0, 9]) {
        assert.deepEqual(trackLine(en, 'vocab', { done, total: 210 }), { kind: 'milestone', text: 'Learn your first 10 words' });
    }
    assert.deepEqual(trackLine(en, 'vocab', { done: 10, total: 210 }), { kind: 'count', text: 'Words learned: 10 of 210', fill: 10 / 210 });
});

test('the tutor has no line, nor does any track before progress is read, and the share stays between 0 and 1', () => {
    assert.equal(trackLine(en, 'tutor', { done: 3, total: 9 }), null);
    assert.equal(trackLine(en, 'script', null), null);
    const fill = (done: number, total: number) => {
        const line = trackLine(en, 'script', { done, total });
        return line?.kind === 'count' ? line.fill : null;
    };
    assert.equal(fill(12, 9), 1, 'a lesson removed since it was done');
    assert.equal(fill(3, 0), 0);
});

test('each track says where it fits for the default learner, in the hub\'s order', () => {
    assert.deepEqual(TRACK_IDS.map((id) => orderLine(en, id, null)), [
        'Start here',
        'Alongside the script lessons',
        'Once you can read a few words',
        'Any time',
    ]);
});

test('a finished lesson track stops saying where it fits; the others keep their line', () => {
    assert.equal(orderLine(en, 'script', { done: 9, total: 9 }), null);
    assert.equal(orderLine(en, 'script', { done: 8, total: 9 }), 'Start here');
    assert.equal(orderLine(en, 'grammar', { done: 12, total: 12 }), null);
    assert.equal(orderLine(en, 'vocab', { done: 210, total: 210 }), 'Once you can read a few words');
    assert.equal(orderLine(en, 'tutor', null), 'Any time');
});
