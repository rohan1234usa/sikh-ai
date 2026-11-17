import { test } from 'node:test';
import assert from 'node:assert/strict';
import en from '@/lib/i18n/dictionaries/en';
import { placeWords, reviewLabel, timeWords } from '@/lib/learn/status';

// 60 + 90 + 30 seconds of sections and 140 of quiz: 320 in all.
const PACE = { sections: [60, 90, 30], quiz: 140 };

test('a lesson not started, or done, says how long the whole of it takes', () => {
    for (const place of [{ kind: 'new' }, { kind: 'done' }] as const) {
        assert.equal(placeWords(en, place, PACE), null);
        assert.equal(timeWords(en, place, PACE), 'About 5 min');
    }
});

test('a lesson started says where the learner is, and how long the rest takes', () => {
    assert.equal(placeWords(en, { kind: 'section', index: 0 }, PACE), 'Section 1 of 3');
    assert.equal(timeWords(en, { kind: 'section', index: 0 }, PACE), 'About 5 min left');
    assert.equal(placeWords(en, { kind: 'section', index: 1 }, PACE), 'Section 2 of 3');
    assert.equal(timeWords(en, { kind: 'section', index: 1 }, PACE), 'About 4 min left', '90 + 30 + 140 seconds');
    assert.equal(placeWords(en, { kind: 'quiz' }, PACE), 'Ready for the quiz');
    assert.equal(timeWords(en, { kind: 'quiz' }, PACE), 'About 2 min left', 'the quiz alone');
});

test('the way into a review says how many cards are due, and is left out when none is', () => {
    assert.equal(reviewLabel(en, 0), null);
    assert.equal(reviewLabel(en, 1), 'Review 1 card due');
    assert.equal(reviewLabel(en, 12), 'Review 12 cards due');
});
