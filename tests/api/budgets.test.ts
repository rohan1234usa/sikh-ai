import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
    CHAT_BUDGET_MS,
    CHAT_FIRST_TEXT_MS,
    LEARN_BUDGET_MS,
    LEARN_FIRST_TEXT_MS,
    LIVE_TRANSLATE_BUDGET_MS,
    LIVE_TRANSLATE_FIRST_TEXT_MS,
    TRANSLATE_BUDGET_MS,
    TRANSLATE_FIRST_TEXT_MS,
    TRANSLATE_GOOGLE_TIMEOUT_MS,
    TRANSLATE_REPLY_NEEDS_MS,
    VOICE_FALLBACK_NEEDS_MS,
    VOICE_TRANSLATE_BUDGET_MS,
    VOICE_TRANSLATE_FIRST_TEXT_MS,
} from '@/lib/gemini/budgets';
import { MIN_FALLBACK_MS } from '@/lib/gemini/fallback';
import { maxDuration as chatMaxDuration } from '@/app/api/chat/route';
import { maxDuration as learnMaxDuration } from '@/app/api/learn/route';
import { maxDuration as translateMaxDuration } from '@/app/api/translate/route';
import { maxDuration as liveMaxDuration } from '@/app/api/translate/live/route';
import { maxDuration as voiceMaxDuration } from '@/app/api/translate/voice/route';

// Every Gemini route sets maxDuration = 30 s; the translator keeps 8 s of
// that for Cloud Translation after Gemini has had its turn.
const MAX_DURATION_MS = 30_000;
const CLOUD_FALLBACK_MS = 8_000;
// The attempt's wait starts after the budget does, and a failed attempt takes
// a moment to unwind, so a gap of exactly MIN_FALLBACK_MS still falls short.
const UNWIND_MS = 1_000;
// Google ends a call 1.5 to 1.9 s before the deadline it's sent
// (X-Server-Timeout), with its own 504 (#83).
const GOOGLE_CUTS_EARLY_MS = 2_000;

test('a hung primary still leaves the fallback model room to answer', () => {
    // The bug this guards: translate ran 20 s with a 15 s attempt cap, a 5 s
    // gap against a 6 s minimum, so a hang never reached the second model.
    // The live translator's 10 s and 4 s missed it the same way, by the few
    // milliseconds its first attempt took to set up.
    for (const [name, budget, attempt] of [
        ['translate', TRANSLATE_BUDGET_MS, TRANSLATE_FIRST_TEXT_MS],
        ['chat', CHAT_BUDGET_MS, CHAT_FIRST_TEXT_MS],
        ['learn', LEARN_BUDGET_MS, LEARN_FIRST_TEXT_MS],
        ['translate live', LIVE_TRANSLATE_BUDGET_MS, LIVE_TRANSLATE_FIRST_TEXT_MS],
        ['translate voice', VOICE_TRANSLATE_BUDGET_MS, VOICE_TRANSLATE_FIRST_TEXT_MS],
    ] as const) {
        assert.ok(
            budget - attempt >= MIN_FALLBACK_MS + UNWIND_MS,
            `${name}: ${budget} ms budget minus a ${attempt} ms attempt leaves ${budget - attempt} ms, under the ${MIN_FALLBACK_MS} ms minimum plus ${UNWIND_MS} ms to unwind`,
        );
    }
});

test("the voice fallback has time to think and still write its lines", () => {
    // At 20 s, a fallback that thought for 9 s was cut off mid-reply: the
    // deadline holds while the body streams. 20 s and 10 s, or 25 s and 14 s,
    // would pass the test above and fail this one.
    const left = VOICE_TRANSLATE_BUDGET_MS - VOICE_TRANSLATE_FIRST_TEXT_MS;
    assert.ok(left >= VOICE_FALLBACK_NEEDS_MS + UNWIND_MS, `the voice fallback gets ${left} ms, under the ${VOICE_FALLBACK_NEEDS_MS} ms it needs plus ${UNWIND_MS} ms to unwind`);
    assert.ok(VOICE_FALLBACK_NEEDS_MS + UNWIND_MS > 20_000 - 10_000, 'the old 20 s and 10 s would fail');
});

test("a full translation fits: the slowest measured, inside a deadline Google doesn't cut short", () => {
    // At one 12 s attempt, which Google cut at about 10.4 s, every text over
    // about 300 characters failed (#83).
    assert.ok(
        TRANSLATE_BUDGET_MS >= TRANSLATE_REPLY_NEEDS_MS + UNWIND_MS,
        `a ${TRANSLATE_BUDGET_MS} ms budget is under the ${TRANSLATE_REPLY_NEEDS_MS} ms a full answer needs, plus ${UNWIND_MS} ms`,
    );
    // The route tells Google the function's own limit, not its budget.
    assert.equal(TRANSLATE_GOOGLE_TIMEOUT_MS, translateMaxDuration * 1000, "Google is told the function's own limit");
    assert.ok(
        TRANSLATE_GOOGLE_TIMEOUT_MS - GOOGLE_CUTS_EARLY_MS >= TRANSLATE_BUDGET_MS,
        "Google would end a slow reply before the route's own deadline",
    );
});

test('the budgets fit inside the function limit', () => {
    for (const seconds of [chatMaxDuration, learnMaxDuration, translateMaxDuration, liveMaxDuration, voiceMaxDuration]) {
        assert.equal(seconds * 1000, MAX_DURATION_MS, 'a route’s maxDuration changed: recheck its budget');
    }
    assert.ok(TRANSLATE_BUDGET_MS + CLOUD_FALLBACK_MS <= MAX_DURATION_MS, 'Cloud Translation still gets its turn');
    assert.ok(CHAT_BUDGET_MS <= MAX_DURATION_MS);
    assert.ok(LEARN_BUDGET_MS <= MAX_DURATION_MS);
    assert.ok(LIVE_TRANSLATE_BUDGET_MS <= MAX_DURATION_MS);
    assert.ok(VOICE_TRANSLATE_BUDGET_MS <= MAX_DURATION_MS);
});
