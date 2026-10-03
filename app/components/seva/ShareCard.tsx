'use client';

import { useEffect, useRef, useState } from 'react';
import { CalendarDaysIcon, LinkIcon, ShareIcon } from '@heroicons/react/24/outline';
import ExternalLink from '@/app/components/ExternalLink';
import { SECONDARY_BUTTON } from '@/app/components/buttons';
import { ERROR_TEXT, INPUT } from '@/app/components/form/Field';
import { useAnnouncer } from '@/app/components/useAnnouncer';
import type { SevaCopy } from '@/lib/i18n/seva';
import { useEvent } from './EventContext';
import { useCanShare } from './hooks';

const LINK_BUTTON = `${SECONDARY_BUTTON} w-full justify-start`;

// Adding the event to a calendar: Google's own link, and a file for the rest.
// Plain links, which work without JavaScript; gone once the event is off.
export function CalendarCard({ copy, googleHref, icsHref }: { copy: SevaCopy['event'] & { newTab: string }; googleHref: string; icsHref: string }) {
    const { event, ended } = useEvent();
    if (ended || event.status === 'cancelled') return null;
    return (
        <section aria-labelledby="calendar-heading" className="rounded-xl border border-edge bg-surface-raised p-5 shadow-sm">
            <h2 id="calendar-heading" className="flex items-center gap-2 text-lg font-bold text-ink">
                <CalendarDaysIcon className="h-5 w-5 text-accent-text" aria-hidden="true" />
                {copy.calendarHeading}
            </h2>
            <div className="mt-3 space-y-2">
                <ExternalLink href={googleHref} newTab={copy.newTab} className={LINK_BUTTON}>{copy.googleCalendar}</ExternalLink>
                <a href={icsHref} className={LINK_BUTTON}>{copy.icsFile}</a>
            </div>
        </section>
    );
}

// Passing the event on: the phone's own share sheet where there is one, the
// link copied, or straight to WhatsApp, where most of the sangat already is.
export function ShareCard({ copy, url, title, text, whatsappHref }: {
    copy: SevaCopy['actions'] & { heading: string; whatsapp: string; newTab: string };
    url: string;
    title: string;
    text: string;
    whatsappHref: string;
}) {
    const { event, ended } = useEvent();
    const canShare = useCanShare();
    const [copied, setCopied] = useState(false);
    const [fallback, setFallback] = useState(false);
    const fieldRef = useRef<HTMLInputElement>(null);
    const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
    const { announce, announcer } = useAnnouncer();

    useEffect(() => () => clearTimeout(timer.current), []);
    useEffect(() => {
        if (fallback) fieldRef.current?.select();
    }, [fallback]);

    if (ended || event.status === 'cancelled') return null;

    const share = async () => {
        try {
            await navigator.share({ title, text, url });
        } catch { /* closed, or not allowed: nothing to say */ }
    };

    const copy_ = async () => {
        try {
            await navigator.clipboard.writeText(url);
            setCopied(true);
            announce(copy.copied);
            clearTimeout(timer.current);
            timer.current = setTimeout(() => setCopied(false), 2000);
        } catch {
            setFallback(true);
        }
    };

    return (
        <section aria-labelledby="share-heading" className="rounded-xl border border-edge bg-surface-raised p-5 shadow-sm">
            <h2 id="share-heading" className="flex items-center gap-2 text-lg font-bold text-ink">
                <ShareIcon className="h-5 w-5 text-accent-text" aria-hidden="true" />
                {copy.heading}
            </h2>
            <div className="mt-3 space-y-2">
                {canShare && (
                    <button type="button" onClick={share} className={LINK_BUTTON}>{copy.share}</button>
                )}
                <button type="button" onClick={copy_} className={LINK_BUTTON}>
                    <LinkIcon className="h-4 w-4" aria-hidden="true" />
                    {copied ? copy.copied : copy.copyLink}
                </button>
                <ExternalLink href={whatsappHref} newTab={copy.newTab} className={LINK_BUTTON}>{copy.whatsapp}</ExternalLink>
            </div>
            {fallback && (
                <div className="mt-3">
                    <p role="alert" className={ERROR_TEXT}>{copy.copyFailed}</p>
                    <label htmlFor="share-link" className="sr-only">{copy.linkLabel}</label>
                    <input id="share-link" ref={fieldRef} readOnly value={url} onFocus={(e) => e.target.select()} className={`mt-2 ${INPUT}`} />
                </div>
            )}
            {announcer}
        </section>
    );
}
