import { test } from 'node:test';
import assert from 'node:assert/strict';
import { usageOf } from '../../scripts/translate-eval/call';
import { costOf, priceYear } from '../../scripts/translate-eval/prices';

test('3.8 Flash costs twice as much from 1 Jan 2027, and a cached token a tenth of an input token', () => {
    const answer = { prompt: 1_000_000, output: 100_000, thoughts: 100_000 };
    assert.equal(costOf('gemini-3.8-flash', answer, '2026'), 1.5);
    assert.equal(costOf('gemini-3.8-flash', answer, '2027'), 3);
    // Half the prompt served from the cache: 500k at $0.75 and 500k at $0.075.
    assert.equal(costOf('gemini-3.8-flash', { prompt: 1_000_000, cached: 500_000 }, '2026'), 0.4125);
    // A cached count can't exceed the prompt it is part of.
    assert.equal(costOf('gemini-3.8-flash', { prompt: 1_000, cached: 5_000 }, '2026'), costOf('gemini-3.8-flash', { prompt: 1_000, cached: 1_000 }, '2026'));
});

test('Flash-Lite keeps its price, the retired 3.7 Flash is priced as the 3.8 Flash that answers for it, and unknowns are null', () => {
    assert.equal(costOf('gemini-3.5-flash-lite', { prompt: 1_000_000 }, '2027'), 0.3);
    assert.equal(costOf('gemini-3.7-flash', { prompt: 1_000_000 }, '2027'), costOf('gemini-3.8-flash', { prompt: 1_000_000 }, '2027'));
    assert.equal(costOf('gemini-unpriced', { prompt: 1 }, '2026'), null);
    assert.equal(costOf('gemini-3.8-flash', {}, '2026'), null);
});

test('the 2026 rates hold through 31 December 2026', () => {
    assert.equal(priceYear(new Date('2026-12-31T23:59:59Z')), '2026');
    assert.equal(priceYear(new Date('2027-01-01T00:00:00Z')), '2027');
});

test('an eval run records what Gemini\'s cache served, as 0 when the API leaves it out', () => {
    assert.deepEqual(
        usageOf({ promptTokenCount: 5220, cachedContentTokenCount: 2763, candidatesTokenCount: 221, thoughtsTokenCount: 0 }),
        { prompt: 5220, cached: 2763, output: 221, thoughts: 0 },
    );
    assert.deepEqual(usageOf({ promptTokenCount: 1971, candidatesTokenCount: 419 }), { prompt: 1971, cached: 0, output: 419, thoughts: undefined });
    // No usage at all: nothing recorded, not a made-up 0.
    assert.deepEqual(usageOf(undefined), {});
});
