// SERVER-ONLY: how long each route gives Gemini, and how long it waits on one
// attempt before giving up on it.
//
// The gap between the two is what the fallback model has to work with. Set the
// per-attempt wait too close to the whole budget and the gap falls below
// MIN_FALLBACK_MS, so the fallback never starts — for the one failure it was
// added for, a primary that hangs. Translate sat at 20 s and 15 s, a 5 s gap
// against a 6 s minimum, and every hang fell straight through to Cloud
// Translation. The wait starts a little after the budget does, and the
// failed attempt takes a moment to unwind, so a gap of exactly the minimum
// is not enough either: tests/api/budgets.test.ts holds every route to the
// minimum plus a second.
//
// Every budget sits inside the routes' `maxDuration = 30`, leaving the
// translator's Cloud fallback (8 s) room after Gemini has had its turn.

export const CHAT_BUDGET_MS = 27_000;
// A stream that has sent nothing by now is treated as a failure, so the
// fallback model can still answer inside the budget.
export const CHAT_FIRST_TEXT_MS = 10_000;

export const TRANSLATE_BUDGET_MS = 20_000;
export const TRANSLATE_ATTEMPT_MS = 12_000;

// The live translator streams three short lines while the user types, so an
// answer that is slow is already stale: the page asks again at the next
// pause. A first line that hasn't come after 4 s means the call is stuck,
// and the 7 s left give the fallback model its minimum. (At 10 s, a stuck
// call left just under 6 s, and never reached the fallback.)
export const LIVE_TRANSLATE_BUDGET_MS = 11_000;
export const LIVE_TRANSLATE_FIRST_TEXT_MS = 4_000;

// Talk's voice route (/api/translate/voice): Gemini has to take in the clip
// before its first token, so the first line gets longer than the live
// translator's, and a first line that hasn't come after 6 s means the call
// is stuck. 8 s are left for the fallback model, and the whole budget, with
// the reply's few seconds of streaming, sits well inside maxDuration.
export const VOICE_TRANSLATE_BUDGET_MS = 14_000;
export const VOICE_TRANSLATE_FIRST_TEXT_MS = 6_000;

// The Punjabi tutor streams like the chat. Its first word came in about a
// second in testing (a smaller prompt than the chat's, LOW thinking), so one
// that hasn't come after 8 s means the call is stuck, and 19 s remain for
// the fallback model.
export const LEARN_BUDGET_MS = 27_000;
export const LEARN_FIRST_TEXT_MS = 8_000;
