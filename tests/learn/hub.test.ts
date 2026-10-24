import { test } from 'node:test';
import assert from 'node:assert/strict';
import { stepKind } from '@/lib/learn/hub';
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
