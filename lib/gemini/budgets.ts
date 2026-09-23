// SERVER-ONLY: how long each route gives Gemini, and how long it waits on one
// attempt before giving up on it.
//
// The gap between the two is what the fallback model has to work with. Set the
// per-attempt wait too close to the whole budget and the gap falls below
// MIN_FALLBACK_MS, so the fallback never starts — for the one failure it was
// added for, a primary that hangs. Translate sat at 20 s and 15 s, a 5 s gap
// against a 6 s minimum, and every hang fell straight through to Cloud
// Translation. tests/api/budgets.test.ts holds both routes to that rule.
//
// Both budgets sit inside the routes' `maxDuration = 30`, leaving the
// translator's Cloud fallback (8 s) room after Gemini has had its turn.

export const CHAT_BUDGET_MS = 27_000;
// A stream that has sent nothing by now is treated as a failure, so the
// fallback model can still answer inside the budget.
export const CHAT_FIRST_TEXT_MS = 10_000;

export const TRANSLATE_BUDGET_MS = 20_000;
export const TRANSLATE_ATTEMPT_MS = 12_000;
