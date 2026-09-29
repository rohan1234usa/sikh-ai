'use client';

import Link from 'next/link';
import { useState, type ComponentProps } from 'react';

// A Link that prefetches only once the visitor shows intent: hover, keyboard
// focus or a touch. Every page is rendered on the server for each request,
// so a plain Link prefetches everything that scrolls into view. On the home
// page, the navbar, footer and cards made 14 such server requests per visit,
// each for a click that might never come. Hover and touch still start the
// fetch before the click lands.
export default function IntentLink({ onMouseEnter, onFocus, onTouchStart, ...props }: Omit<ComponentProps<typeof Link>, 'prefetch'>) {
    const [intent, setIntent] = useState(false);

    return (
        <Link
            {...props}
            prefetch={intent ? null : false}
            onMouseEnter={(e) => { setIntent(true); onMouseEnter?.(e); }}
            onFocus={(e) => { setIntent(true); onFocus?.(e); }}
            onTouchStart={(e) => { setIntent(true); onTouchStart?.(e); }}
        />
    );
}
