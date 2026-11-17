import { test } from 'node:test';
import assert from 'node:assert/strict';
import { usageOf } from '../../scripts/translate-eval/call';

test('an eval run records what Gemini\'s cache served, as 0 when the API leaves it out', () => {
    assert.deepEqual(
        usageOf({ promptTokenCount: 5220, cachedContentTokenCount: 2763, candidatesTokenCount: 221, thoughtsTokenCount: 0 }),
        { prompt: 5220, cached: 2763, output: 221, thoughts: 0 },
    );
    assert.deepEqual(usageOf({ promptTokenCount: 1971, candidatesTokenCount: 419 }), { prompt: 1971, cached: 0, output: 419, thoughts: undefined });
    // No usage at all: nothing recorded, not a made-up 0.
    assert.deepEqual(usageOf(undefined), {});
});
