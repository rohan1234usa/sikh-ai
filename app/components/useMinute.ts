'use client';

import { useSyncExternalStore } from 'react';

// The time, to the minute, for what changes as time passes on a page left
// open: Seva's "ended" and "happening now", Learn's flashcards coming due. It
// is read every 15 seconds and again the moment a hidden tab is shown (a
// browser slows a background tab's timers), but a reader renders again only
// when the minute changes. Null on the server and in the first render in the
// browser, which must match it. The subscription and the reading are
// exported for the tests.
export const subscribeMinute = (onChange: () => void) => {
    const timer = setInterval(onChange, 15_000);
    document.addEventListener('visibilitychange', onChange);
    return () => {
        clearInterval(timer);
        document.removeEventListener('visibilitychange', onChange);
    };
};
export const thisMinute = () => Math.floor(Date.now() / 60_000) * 60_000;
export const useMinute = (): number | null => useSyncExternalStore(subscribeMinute, thisMinute, () => null);
