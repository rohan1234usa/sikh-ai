import { ArrowRightIcon } from '@heroicons/react/24/outline';
import IntentLink from '@/app/components/IntentLink';
import { SECONDARY_BUTTON } from '@/app/components/buttons';
import type { Lang } from '@/lib/i18n/config';
import { localePath } from '@/lib/i18n/paths';
import type { SevaCopy } from '@/lib/i18n/seva';
import { CREATE_HREF, SEVA_HREF, eventHref } from '@/lib/seva/config';
import { describeEvent } from '@/lib/seva/display';
import type { SevaEvent } from '@/lib/seva/model';
import EventCard from './EventCard';

// The home page's way into Seva: the next few events, the whole list, and
// hosting. Written on the server, like the rest of the home page.
export default function UpcomingSevaStrip({ lang, copy, events }: { lang: Lang; copy: SevaCopy; events: SevaEvent[] }) {
    const to = (path: string) => localePath(lang, path);
    return (
        <section aria-labelledby="upcoming-seva" className="border-y border-edge bg-surface-raised px-6 py-12 md:py-16">
            <div className="mx-auto max-w-7xl">
                <div className="flex flex-wrap items-end justify-between gap-4">
                    <div>
                        <h2 id="upcoming-seva" className="text-2xl font-bold text-ink md:text-3xl">{copy.home.title}</h2>
                        <p className="mt-2 text-ink-muted">{copy.home.subtitle}</p>
                    </div>
                    <IntentLink href={to(SEVA_HREF)} className="inline-flex items-center gap-1 font-semibold text-accent-text hover:underline">
                        {copy.home.seeAll}
                        <ArrowRightIcon className="h-4 w-4" aria-hidden="true" />
                    </IntentLink>
                </div>
                {events.length > 0 ? (
                    <ul className="mt-6 grid gap-4 md:grid-cols-3">
                        {events.map((event) => (
                            <li key={event.id}>
                                <EventCard event={event} display={describeEvent(event, lang, copy)} href={to(eventHref(event.id))} copy={copy.common} showDate />
                            </li>
                        ))}
                    </ul>
                ) : (
                    <p className="mt-6 text-ink-muted">{copy.home.empty}</p>
                )}
                <IntentLink href={to(CREATE_HREF)} className={`mt-6 ${SECONDARY_BUTTON}`}>{copy.home.host}</IntentLink>
            </div>
        </section>
    );
}
