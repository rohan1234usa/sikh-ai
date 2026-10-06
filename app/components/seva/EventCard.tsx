import IntentLink from '@/app/components/IntentLink';
import Mixed from '@/app/components/learn/Mixed';
import type { SevaCopy } from '@/lib/i18n/seva';
import type { EventDisplay } from '@/lib/seva/display';
import { isFull } from '@/lib/seva/event';
import type { SevaEvent } from '@/lib/seva/model';
import CapacityLine from './CapacityLine';
import MyPartChip from './MyPartChip';

export const CHIP = 'inline-flex items-center rounded-full border border-edge-strong px-2.5 py-0.5 text-sm text-ink';

// One event on the board or the home page: its title is the link to its page,
// stretched over the card, and the rest is a list of facts. Under a day's
// heading only the times are given; elsewhere the whole date. On the board,
// where "Your seva" has read what the one signed in hosts and has joined,
// the card says so (markMine).
export default function EventCard({ event, display, href, copy, showDate = false, markMine = false }: {
    event: SevaEvent;
    display: EventDisplay;
    href: string;
    copy: SevaCopy['common'];
    showDate?: boolean;
    markMine?: boolean;
}) {
    const titleId = `event-${event.id}`;
    const full = isFull(event);
    return (
        <article
            aria-labelledby={titleId}
            className="relative h-full rounded-xl border border-edge bg-surface-raised p-4 shadow-sm transition-colors hover:border-accent-text/50 sm:p-5"
        >
            <p className="flex flex-wrap items-center gap-2">
                <span className={CHIP}>{copy.categories[event.category]}</span>
                {full && <span className={`${CHIP} font-semibold`}>{copy.full}</span>}
                {markMine && <MyPartChip eventId={event.id} labels={{ hosting: copy.youHost, joined: copy.youJoined }} />}
            </p>
            <h3 id={titleId} className="mt-2 text-lg font-bold leading-snug text-ink [overflow-wrap:anywhere]">
                <IntentLink href={href} className="after:absolute after:inset-0 after:content-[''] hover:underline">
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
                <CapacityLine capacity={display.capacity} spotsLeft={display.spotsLeft} percent={display.percent} full={full} fullLabel={copy.full} />
            </p>
        </article>
    );
}
