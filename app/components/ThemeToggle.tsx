'use client';

import { useSyncExternalStore } from 'react';
import { SunIcon, MoonIcon } from '@heroicons/react/24/outline';

// The <html> class is the source of truth (set pre-paint by the inline script
// in layout.tsx). Subscribing via MutationObserver keeps the icon correct no
// matter what flips the class.
function subscribe(onChange: () => void) {
    const observer = new MutationObserver(onChange);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
    return () => observer.disconnect();
}

const isDark = () => document.documentElement.classList.contains('dark');
const serverSnapshot = () => false; // corrected right after hydration

export default function ThemeToggle() {
    const dark = useSyncExternalStore(subscribe, isDark, serverSnapshot);

    const toggle = () => {
        const next = !isDark();
        document.documentElement.classList.toggle('dark', next);
        try { localStorage.theme = next ? 'dark' : 'light'; } catch { }
    };

    return (
        <button
            type="button"
            onClick={toggle}
            aria-label={dark ? 'Switch to light mode' : 'Switch to dark mode'}
            className="p-2 rounded-lg text-slate-300 hover:text-kesri transition-colors"
        >
            {dark ? <SunIcon className="w-5 h-5" /> : <MoonIcon className="w-5 h-5" />}
        </button>
    );
}
