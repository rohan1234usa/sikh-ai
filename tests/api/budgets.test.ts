import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
    CHAT_BUDGET_MS,
    CHAT_FIRST_TEXT_MS,
    TRANSLATE_ATTEMPT_MS,
    TRANSLATE_BUDGET_MS,
} from '@/lib/gemini/budgets';
import { MIN_FALLBACK_MS } from '@/lib/gemini/fallback';

// Both routes set maxDuration = 30 s; the translator keeps 8 s of that for
// Cloud Translation after Gemini has had its turn.
const MAX_DURATION_MS = 30_000;
const CLOUD_FALLBACK_MS = 8_000;

test('a hung primary still leaves the fallback model room to answer', () => {
    // The bug this guards: translate ran 20 s with a 15 s attempt cap, a 5 s
    // gap against a 6 s minimum, so a hang never reached the second model.
    for (const [name, budget, attempt] of [
        ['translate', TRANSLATE_BUDGET_MS, TRANSLATE_ATTEMPT_MS],
        ['chat', CHAT_BUDGET_MS, CHAT_FIRST_TEXT_MS],
    ] as const) {
        assert.ok(
            budget - attempt >= MIN_FALLBACK_MS,
            `${name}: ${budget} ms budget minus a ${attempt} ms attempt leaves ${budget - attempt} ms, under the ${MIN_FALLBACK_MS} ms minimum`,
        );
    }
});

test('the budgets fit inside the function limit', () => {
    assert.ok(TRANSLATE_BUDGET_MS + CLOUD_FALLBACK_MS <= MAX_DURATION_MS, 'Cloud Translation still gets its turn');
    assert.ok(CHAT_BUDGET_MS <= MAX_DURATION_MS);
});
