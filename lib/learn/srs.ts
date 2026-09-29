// Spaced repetition for the vocabulary flashcards: a Leitner system of six
// boxes. A card you know moves up a box and comes back later (tomorrow, in
// three days, a week, two weeks, a month); a card you miss drops to the
// first box and is due again straight away. Two answers, "I knew it" and
// "Not yet", suit a phone better than SM-2's graded ones, and a few hundred
// cards need no ease factors. Pure and clock-free: every function takes `now`.

export const DAY_MS = 86_400_000;

// Days until a card in box n comes back. Box 0 is a card just missed.
export const BOX_INTERVALS_DAYS = [0, 1, 3, 7, 14, 30] as const;
export const MAX_BOX = BOX_INTERVALS_DAYS.length - 1;

// A card counts as learned once it has earned the week-long interval.
export const LEARNED_BOX = 3;

// A card comes back on its day, not to the minute: due times are set a few
// hours early, so reviewing at 8 pm isn't locked out by last night's 9 pm.
export const EARLY_MS = 4 * 60 * 60 * 1000;

export type CardState = {
    box: number;     // 0 to MAX_BOX
    due: number;     // when it next comes back, in ms
    reviews: number; // how many times it has been reviewed
    lastAt: number;  // when it was last reviewed, in ms
};

export type CardCounts = { due: number; fresh: number; learned: number; total: number };

// Saved progress is a plain object read back from JSON, so look up only its
// own keys: a word id must never find something on Object.prototype.
export function cardOf(cards: Readonly<Record<string, CardState>>, id: string): CardState | undefined {
    return Object.prototype.hasOwnProperty.call(cards, id) ? cards[id] : undefined;
}

// A new card starts in box 0, so knowing it straight away earns tomorrow.
export function review(state: CardState | undefined, correct: boolean, now: number): CardState {
    const box = correct ? Math.min((state?.box ?? 0) + 1, MAX_BOX) : 0;
    const days = BOX_INTERVALS_DAYS[box];
    return {
        box,
        due: days === 0 ? now : now + days * DAY_MS - EARLY_MS,
        reviews: (state?.reviews ?? 0) + 1,
        lastAt: now,
    };
}

// What a session shows, in order: the cards that are due (lowest box first,
// then the longest overdue), then cards never seen, in the order given. A
// card that isn't due yet never appears.
export function reviewQueue(
    ids: readonly string[],
    cards: Readonly<Record<string, CardState>>,
    now: number,
    limit = 20,
): string[] {
    const due = ids
        .filter((id) => {
            const state = cardOf(cards, id);
            return state !== undefined && state.due <= now;
        })
        .sort((a, b) => cardOf(cards, a)!.box - cardOf(cards, b)!.box || cardOf(cards, a)!.due - cardOf(cards, b)!.due);
    const fresh = ids.filter((id) => cardOf(cards, id) === undefined);
    return [...due, ...fresh].slice(0, Math.max(0, limit));
}

// For a topic's card: due, never seen, and learned. A learned card that is
// due again counts in both.
export function cardCounts(ids: readonly string[], cards: Readonly<Record<string, CardState>>, now: number): CardCounts {
    let due = 0;
    let fresh = 0;
    let learned = 0;
    for (const id of ids) {
        const state = cardOf(cards, id);
        if (!state) {
            fresh++;
            continue;
        }
        if (state.due <= now) due++;
        if (state.box >= LEARNED_BOX) learned++;
    }
    return { due, fresh, learned, total: ids.length };
}
