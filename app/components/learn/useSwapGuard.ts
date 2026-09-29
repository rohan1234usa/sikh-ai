'use client';

import { useCallback, useRef, type KeyboardEvent, type MouseEvent } from 'react';

// For a button that another takes the place of when pressed (Show answer and
// the flashcard answers; Check and Try again): the second click of a
// double-click, or a held key's repeat, would press the new button too.
// A click this soon after the change is dropped; any later one counts,
// however quick the learner. A key press always counts, but not its repeats.
const SWAP_GUARD_MS = 350;

export function useSwapGuard() {
    const changedAt = useRef(0);
    // Call when the buttons change.
    const mark = useCallback(() => {
        changedAt.current = performance.now();
    }, []);
    // Whether a click on the new button should count.
    const allowed = useCallback(
        (event: MouseEvent) => event.detail === 0 || performance.now() - changedAt.current >= SWAP_GUARD_MS,
        [],
    );
    const noRepeat = useCallback((event: KeyboardEvent) => {
        if (event.repeat) event.preventDefault();
    }, []);
    return { mark, allowed, noRepeat };
}
