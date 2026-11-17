'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

// Says what just happened ("Link copied", "Events shown: 4 of 12") to a screen
// reader, without moving focus. The region is on the page from the start, as
// screen readers only announce changes to one they already know. The message
// is cleared first and set a moment later, so the same words twice are heard
// twice. Render `announcer` once, anywhere in the component.
//
// A message given within that moment replaces the one before, as a list's
// count should. With `join`, it is said after it instead, so a page whose
// messages can come at once (Talk's replies, notes and failures) loses none.
export function useAnnouncer({ join = false }: { join?: boolean } = {}) {
    const [message, setMessage] = useState('');
    const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
    const pending = useRef<string[]>([]);

    useEffect(() => () => clearTimeout(timer.current), []);

    const announce = useCallback((text: string) => {
        clearTimeout(timer.current);
        setMessage('');
        pending.current = join ? [...pending.current, text] : [text];
        timer.current = setTimeout(() => {
            setMessage(pending.current.join(' '));
            pending.current = [];
        }, 60);
    }, [join]);

    const announcer = <p role="status" aria-atomic="true" className="sr-only">{message}</p>;
    return { announce, announcer };
}
