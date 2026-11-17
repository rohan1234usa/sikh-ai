'use client';

import { ArrowRightIcon } from '@heroicons/react/24/outline';
import IntentLink from '@/app/components/IntentLink';
import { BUTTON_LG, SECONDARY_BUTTON } from '@/app/components/buttons';
import { useT } from '@/app/context/LanguageContext';
import { reviewLabel } from '@/lib/learn/status';

// The way into a review of every flashcard due (/learn/review), on the hub
// and the vocabulary page. Its room is held from the start, so nothing moves
// when progress is read or a card comes due: empty until progress is read
// (`due` null), a quiet line while nothing is due, then the button.
export default function ReviewSlot({ href, due, className = '' }: { href: string; due: number | null; className?: string }) {
    const t = useT();
    const label = due === null ? null : reviewLabel(t, due);
    return (
        <div className={`flex min-h-11 items-center ${className}`}>
            {label ? (
                <IntentLink href={href} className={`${SECONDARY_BUTTON} ${BUTTON_LG}`}>
                    {label}
                    <ArrowRightIcon className="h-4 w-4" aria-hidden="true" />
                </IntentLink>
            ) : due !== null && <p className="text-sm text-ink-muted">{t.learn.review.noneDue}</p>}
        </div>
    );
}
