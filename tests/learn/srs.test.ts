import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
    BOX_INTERVALS_DAYS,
    DAY_MS,
    EARLY_MS,
    LEARNED_BOX,
    MAX_BOX,
    cardCounts,
    cardOf,
    review,
    reviewQueue,
    type CardState,
} from '@/lib/learn/srs';

const NOW = Date.UTC(2026, 8, 28, 20, 0);

const card = (box: number, due: number, over: Partial<CardState> = {}): CardState =>
    ({ box, due, reviews: 1, lastAt: NOW - DAY_MS, ...over });

test('knowing a new card sends it to tomorrow, a few hours early', () => {
    const next = review(undefined, true, NOW);
    assert.deepEqual(next, { box: 1, due: NOW + DAY_MS - EARLY_MS, reviews: 1, lastAt: NOW });
});

test('each right answer climbs one box and waits that box\'s interval', () => {
    let state: CardState | undefined;
    for (let box = 1; box <= MAX_BOX; box++) {
        state = review(state, true, NOW);
        assert.equal(state.box, box);
        assert.equal(state.due, NOW + BOX_INTERVALS_DAYS[box] * DAY_MS - EARLY_MS);
    }
    assert.equal(state!.reviews, MAX_BOX);
});

test('the top box keeps a card there', () => {
    const top = review(card(MAX_BOX, NOW), true, NOW);
    assert.equal(top.box, MAX_BOX);
});

test('a miss drops a card to the first box, due again at once', () => {
    const missed = review(card(4, NOW, { reviews: 6 }), false, NOW);
    assert.deepEqual(missed, { box: 0, due: NOW, reviews: 7, lastAt: NOW });
    assert.ok(missed.due <= NOW, 'due again at once');
});

test('a session shows due cards by box then age, then new ones, never cards not yet due', () => {
    const cards: Record<string, CardState> = {
        a: card(2, NOW - 10),
        b: card(0, NOW - 5),
        c: card(2, NOW - 100),
        d: card(3, NOW + DAY_MS), // not due
    };
    assert.deepEqual(reviewQueue(['a', 'b', 'c', 'd', 'e', 'f'], cards, NOW), ['b', 'c', 'a', 'e', 'f']);
    assert.deepEqual(reviewQueue(['a', 'b', 'c', 'd', 'e', 'f'], cards, NOW, 2), ['b', 'c']);
    assert.deepEqual(reviewQueue(['d'], cards, NOW), []);
});

test('a word id never finds something on Object.prototype', () => {
    assert.equal(cardOf({}, 'constructor'), undefined);
    assert.deepEqual(reviewQueue(['constructor'], {}, NOW), ['constructor']);
});

test('a topic counts its due, new and learned cards', () => {
    const cards: Record<string, CardState> = {
        a: card(LEARNED_BOX, NOW - 1), // learned and due again
        b: card(1, NOW + DAY_MS),
        c: card(MAX_BOX, NOW + DAY_MS),
    };
    assert.deepEqual(cardCounts(['a', 'b', 'c', 'd'], cards, NOW), { due: 1, fresh: 1, learned: 2, total: 4 });
});
