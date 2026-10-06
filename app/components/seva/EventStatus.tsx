'use client';

import { useEffect, useRef } from 'react';
import { fmt } from '@/lib/i18n/fmt';
import type { Lang } from '@/lib/i18n/config';
import type { SevaCopy } from '@/lib/i18n/seva';
import { takesSignups } from '@/lib/seva/event';
import { formatWhen, zoneOffset, type WhenWords } from '@/lib/seva/time';
import { useEvent } from './EventContext';

// The event is over, or off. The cached page says so from when it was built;
// this keeps it true as the clock runs and as the host cancels or reopens.
export function StatusBanner({ copy }: { copy: SevaCopy['event'] }) {
    const { event, ended } = useEvent();
    if (event.status === 'cancelled') {
        return (
            <div className="mt-6 rounded-xl border-2 border-red-700 bg-surface-raised p-4 dark:border-red-400">
                <h2 className="font-bold text-ink">{copy.cancelledTitle}</h2>
                <p className="mt-1 text-ink">{copy.cancelledBody}</p>
                {event.cancelNote && <p className="mt-2 text-ink [overflow-wrap:anywhere]">{fmt(copy.hostNote, { note: event.cancelNote })}</p>}
            </div>
        );
    }
    if (ended) {
        return (
            <div className="mt-6 rounded-xl border border-edge-strong bg-surface-raised p-4">
                <h2 className="font-bold text-ink">{copy.endedTitle}</h2>
                <p className="mt-1 text-ink-muted">{copy.endedBody}</p>
            </div>
        );
    }
    return null;
}

// "Your event is live", "Changes saved": the word after a change made on the
// hosting form, which takes the focus so it's heard first. An event that
// takes no sign-ups has no one joining to see or tell.
export function FlashPanel({ copy }: { copy: SevaCopy['actions'] }) {
    const { event, flash, dismissFlash } = useEvent();
    const ref = useRef<HTMLHeadingElement>(null);
    useEffect(() => { if (flash) ref.current?.focus(); }, [flash]);
    if (!flash) return null;
    const signups = takesSignups(event);
    const [title, body] = flash === 'posted'
        ? [copy.postedTitle, signups ? copy.postedBody : copy.postedBodyNoSignup]
        : [copy.savedTitle, signups ? copy.savedBody : copy.savedBodyNoSignup];
    return (
        <div className="mt-6 rounded-xl border-2 border-kesri-deep bg-surface-raised p-4 dark:border-kesri">
            <h2 ref={ref} tabIndex={-1} className="font-bold text-ink">{title}</h2>
            <p className="mt-1 text-ink">{body}</p>
            <button
                type="button"
                onClick={() => {
                    dismissFlash();
                    document.getElementById('event-title')?.focus();
                }}
                className="mt-3 font-semibold text-accent-text underline"
            >
                {copy.done}
            </button>
        </div>
    );
}

// The time at the venue is the page's; the viewer's own, when it's another,
// is added here, in the browser, which alone knows where the viewer is.
export function YourTime({ startsAt, endsAt, timeZone, lang, words, label }: {
    startsAt: number;
    endsAt: number;
    timeZone: string;
    lang: Lang;
    words: WhenWords;
    // "Your time: {when}"
    label: string;
}) {
    const { now } = useEvent();
    if (now === null) return null;
    let mine: string;
    try {
        mine = Intl.DateTimeFormat().resolvedOptions().timeZone;
        if (!mine || zoneOffset(startsAt, mine) === zoneOffset(startsAt, timeZone)) return null;
    } catch {
        return null;
    }
    return <p className="mt-1 text-sm text-ink-muted">{fmt(label, { when: formatWhen({ startsAt, endsAt, timeZone: mine }, lang, words) })}</p>;
}
