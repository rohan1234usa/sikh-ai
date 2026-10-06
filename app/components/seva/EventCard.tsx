import type { ReactNode } from 'react';
import IntentLink from '@/app/components/IntentLink';
import Mixed from '@/app/components/learn/Mixed';
import type { SevaCopy } from '@/lib/i18n/seva';
import type { EventDisplay } from '@/lib/seva/display';
import { isFull } from '@/lib/seva/event';
import type { SevaEvent } from '@/lib/seva/model';
import CapacityLine from './CapacityLine';
import { CHIP, PANEL } from './styles';

// One event on the board or the home page: its title is the link to its page,
// stretched over the card, and the rest is a list of facts. Under a day's
// heading only the times are given; elsewhere the whole date. On the board,
// `mark` draws a chip for the one signed in (MyPartChip), with the id the
// title's link takes as its description, so a screen reader moving by link
// hears it too. It's passed in, not imported here, so the home page's strip,
// which has none, doesn't load it.
export default function EventCard({ event, display, href, copy, showDate = false, mark }: {
    event: SevaEvent;
    display: EventDisplay;
    href: string;
    copy: SevaCopy['common'];
    showDate?: boolean;
    mark?: (id: string) => ReactNode;
}) {
    const titleId = `event-${event.id}`;
    const markId = `${titleId}-mark`;
    const full = isFull(event);
    return (
        <article
            aria-labelledby={titleId}
            className={`relative h-full ${PANEL} transition-colors hover:border-accent-text/50`}
        >
            <p className="flex flex-wrap items-center gap-2">
                <span className={CHIP}>{copy.categories[event.category]}</span>
                {full && <span className={`${CHIP} font-semibold`}>{copy.full}</span>}
                {mark?.(markId)}
            </p>
            <h3 id={titleId} className="mt-2 text-lg font-bold leading-snug text-ink [overflow-wrap:anywhere]">
                <IntentLink href={href} aria-describedby={mark ? markId : undefined} className="after:absolute after:inset-0 after:content-[''] hover:underline">
                    <Mixed text={event.title} />
                </IntentLink>
            </h3>
            <dl className="mt-2 space-y-1 text-sm text-ink-muted">
                <div>
                    <dt className="sr-only">{copy.whenLabel}</dt>
                    <dd>
                        <time dateTime={display.startIso}>{showDate ? display.when : display.times}</time>
                    </dd>
                </div>
                <div>
                    <dt className="sr-only">{copy.whereLabel}</dt>
                    <dd className="[overflow-wrap:anywhere]"><Mixed text={display.placeShort} /></dd>
                </div>
            </dl>
            <p className="mt-1 text-sm text-ink-muted">
                <CapacityLine signup={display.signup} anyJoined={event.volunteerCount > 0} />
            </p>
        </article>
    );
}
