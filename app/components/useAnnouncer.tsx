'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

// Says what just happened ("Link copied", "Events shown: 4 of 12") to a screen
// reader, without moving focus. The region is on the page from the start, as
// screen readers only announce changes to one they already know. The message
// is cleared first and set a moment later, so the same words twice are heard
// twice. Render `announcer` once, anywhere in the component.
export function useAnnouncer() {
    const [message, setMessage] = useState('');
    const timer = useRef<ReturnType<typeof setTimeout>>(undefined);

    useEffect(() => () => clearTimeout(timer.current), []);

    const announce = useCallback((text: string) => {
        clearTimeout(timer.current);
        setMessage('');
        timer.current = setTimeout(() => setMessage(text), 60);
    }, []);

    const announcer = <p role="status" aria-atomic="true" className="sr-only">{message}</p>;
    return { announce, announcer };
}
