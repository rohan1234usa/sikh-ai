'use client';

import { useEffect } from 'react';

// The line an address points at (#line-…), on a shabad's or an Ang's page:
// marked and brought to the middle of the screen. CSS :target does the
// marking on a full page load, but Next moves between pages with
// history.pushState, which leaves :target behind, so this marks the line
// with data-highlighted instead.
export default function LineHighlight() {
    useEffect(() => {
        let marked: HTMLElement | null = null;
        const show = () => {
            marked?.removeAttribute('data-highlighted');
            marked = null;
            const id = decodeURIComponent(window.location.hash.slice(1));
            const line = id.startsWith('line-') ? document.getElementById(id) : null;
            if (!line) return;
            line.setAttribute('data-highlighted', '');
            line.scrollIntoView({ block: 'center' });
            // A screen reader starts from the line, too.
            line.focus({ preventScroll: true });
            marked = line;
        };
        const frame = requestAnimationFrame(show);
        window.addEventListener('hashchange', show);
        return () => {
            cancelAnimationFrame(frame);
            window.removeEventListener('hashchange', show);
            marked?.removeAttribute('data-highlighted');
        };
    }, []);
    return null;
}
