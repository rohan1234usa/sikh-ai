import type { Metadata } from 'next';
import { cache } from 'react';
import { redirect } from 'next/navigation';
import { MapPinIcon } from '@heroicons/react/24/outline';
import Breadcrumbs from '@/app/components/Breadcrumbs';
import ExternalLink from '@/app/components/ExternalLink';
import IntentLink from '@/app/components/IntentLink';
import { PRIMARY_BUTTON, SECONDARY_BUTTON } from '@/app/components/buttons';
import { StatusPage } from '@/app/components/StatusPage';
import Mixed from '@/app/components/learn/Mixed';
import { EventProvider } from '@/app/components/seva/EventContext';
import { FlashPanel, StatusBanner, YourTime } from '@/app/components/seva/EventStatus';
import HostTools from '@/app/components/seva/HostTools';
import JoinCard from '@/app/components/seva/JoinCard';
import { AdminTools, ReportControl } from '@/app/components/seva/ReportControl';
import { CalendarCard, ShareCard } from '@/app/components/seva/ShareCard';
import { CHIP } from '@/app/components/seva/styles';
import { LANG_META } from '@/lib/i18n/config';
import { fmt } from '@/lib/i18n/fmt';
import { localePath } from '@/lib/i18n/paths';
import { getSevaCopy } from '@/lib/i18n/seva';
import { getServerT } from '@/lib/i18n/server';
import { SITE_URL, pageMetadata } from '@/lib/metadata';
import { ADMIN_HREF, editHref, eventHref, isEventId, postAgainHref } from '@/lib/seva/config';
import { describeEvent } from '@/lib/seva/display';
import { hasEnded, isFull } from '@/lib/seva/event';
import { eventJsonLd, serializeJsonLd } from '@/lib/seva/jsonld';
import { CALENDAR_LINK_CHARS, calendarText, contactHref, googleCalendarUrl, mapsUrl, whatsappUrl } from '@/lib/seva/links';
import { clip, indexable } from '@/lib/seva/meta';
import { fetchEvent, isBuilding, renderTime, sevaProject } from '@/lib/seva/server';

// A page for every event, which is what gets shared: built on the server the
// first time it's opened, then served from the CDN and rebuilt every five
// minutes, or at once after a change made on the site (app/api/seva/refresh).
// None is built ahead of time. Everything a visitor sees is here, without
// Firebase; what depends on who's looking (joining, hosting, moderating) is
// the browser's, once someone signs in.
export function generateStaticParams() {
  return [];
}
export const dynamicParams = true;
export const revalidate = 300; // SEVA_REVALIDATE_SECONDS

// One read for the page and its metadata.
const loadEvent = cache((id: string) => fetchEvent(id));

export async function generateMetadata({ params }: PageProps<'/[lang]/seva/[id]'>): Promise<Metadata> {
  const { id } = await params;
  if (!isEventId(id)) return {};
  const { lang, t } = await getServerT();
  const copy = getSevaCopy(lang);
  const read = await loadEvent(id);
  if (read.kind !== 'ok') {
    return { title: copy.meta.unavailableTitle, robots: { index: false, follow: true }, alternates: { canonical: null } };
  }
  const { event } = read.value;
  const display = describeEvent(event, lang, copy);
  const description = clip(`${fmt(copy.meta.eventDescription, { when: display.when, place: display.placeShort, name: event.organizer })} ${event.description}`);
  const meta = pageMetadata(lang, t, eventHref(id), event.title, description);
  return indexable(event, renderTime()) ? meta : { ...meta, robots: { index: false, follow: true } };
}

export default async function EventPage({ params }: PageProps<'/[lang]/seva/[id]'>) {
  const { lang } = await getServerT();
  const { id } = await params;
  const to = (path: string) => localePath(lang, path);
  const copy = getSevaCopy(lang);
  // Not an event's address at all (/seva/abc): the board. A notFound() here,
  // on a page built at its first visit, would get Next's bare 404 rather than
  // the site's.
  if (!isEventId(id)) redirect(to('/seva'));

  const read = await loadEvent(id);
  if (read.kind === 'failed' && !isBuilding() && sevaProject()) {
    // Thrown rather than shown, so a passing outage isn't cached as this
    // event's page: the error page offers Try again.
    throw new Error('Firestore gave no usable answer for a Seva event');
  }
  if (read.kind !== 'ok') {
    return (
      <StatusPage heading={copy.event.unavailableTitle} body={copy.event.unavailableBody}>
        <IntentLink href={to('/seva')} className={PRIMARY_BUTTON}>{copy.event.unavailableCta}</IntentLink>
      </StatusPage>
    );
  }

  const { event } = read.value;
  const now = renderTime();
  const display = describeEvent(event, lang, copy);
  const url = `${SITE_URL}${to(eventHref(id))}`;
  const contactLink = event.contact ? contactHref(event.contact) : null;
  const shareMessage = fmt(copy.event.shareMessage, { title: event.title, when: display.when, place: display.placeShort, url });
  const calendarDetails = fmt(copy.calendar.details, { name: event.organizer, url });
  const jsonLd = indexable(event, now)
    ? serializeJsonLd(eventJsonLd(event, { url, image: `${SITE_URL}/og.jpg`, description: clip(event.description || display.when, 300), inLanguage: LANG_META[lang].htmlLang }))
    : null;

  return (
    <main className="flex-1">
      {jsonLd && <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd }} />}
      <EventProvider
        initial={{
          id, title: event.title, status: event.status, cancelNote: event.cancelNote, volunteerCount: event.volunteerCount,
          spots: event.spots, startsAt: event.startsAt, endsAt: event.endsAt, hidden: event.hidden,
        }}
        endedAtBuild={hasEnded(event, now)}
      >
        <div className="mx-auto w-full max-w-5xl px-4 py-6 sm:px-6 md:py-10">
          <Breadcrumbs label={copy.common.breadcrumbAria} crumbs={[{ href: to('/seva'), label: copy.board.title }]} />

          <header className="mt-3">
            <p className="flex flex-wrap items-center gap-2">
              <span className={CHIP}>{copy.common.categories[event.category]}</span>
              {isFull(event) && <span className={`${CHIP} font-semibold`}>{copy.common.full}</span>}
            </p>
            <h1 id="event-title" tabIndex={-1} className="mt-3 text-3xl font-bold text-ink md:text-4xl [overflow-wrap:anywhere]"><Mixed text={event.title} /></h1>
            <p className="mt-2 text-ink-muted [overflow-wrap:anywhere]"><Mixed text={fmt(copy.common.hostedBy, { name: event.organizer })} /></p>
          </header>

          <FlashPanel copy={copy.actions} />
          <StatusBanner copy={copy.event} />

          <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem] lg:grid-rows-[auto_1fr] lg:items-start">
            <div className="space-y-6 lg:col-start-1 lg:row-start-1">
              <dl className="space-y-4 rounded-xl border border-edge bg-surface-raised p-5 shadow-sm">
                <div>
                  <dt className="text-sm font-semibold text-ink-muted">{copy.common.whenLabel}</dt>
                  <dd className="mt-1 text-ink">
                    <time dateTime={display.startIso}>{display.when}</time>
                    <YourTime startsAt={event.startsAt} endsAt={event.endsAt} timeZone={event.timeZone} lang={lang} words={copy.common.when} label={copy.actions.yourTime} />
                  </dd>
                </div>
                <div>
                  <dt className="text-sm font-semibold text-ink-muted">{copy.common.whereLabel}</dt>
                  <dd className="mt-1 text-ink [overflow-wrap:anywhere]">
                    <p className="font-semibold"><Mixed text={event.venue} /></p>
                    {[event.address, [event.city, event.region].filter(Boolean).join(', '), display.country].filter(Boolean).map((line, i) => (
                      <p key={i}><Mixed text={line} /></p>
                    ))}
                    <ExternalLink href={mapsUrl(display.placeFull)} newTab={copy.common.newTab} className={`mt-3 ${SECONDARY_BUTTON}`}>
                      <MapPinIcon className="h-4 w-4" aria-hidden="true" />
                      {copy.event.directions}
                    </ExternalLink>
                  </dd>
                </div>
                {event.contact && (
                  <div>
                    <dt className="text-sm font-semibold text-ink-muted">{copy.common.contactLabel}</dt>
                    <dd className="mt-1 text-ink [overflow-wrap:anywhere]">
                      {contactLink ? <a href={contactLink} className="text-accent-text underline">{event.contact}</a> : <Mixed text={event.contact} />}
                    </dd>
                  </div>
                )}
              </dl>
            </div>

            <div className="space-y-6 lg:col-start-2 lg:row-span-2 lg:row-start-1">
              <JoinCard
                copy={copy.actions}
                capacity={{ count: copy.common.capacity, left: copy.common.spotsLeft }}
                fullLabel={copy.common.full}
                hostingLabel={copy.event.youAreHosting}
                contactFallback={event.contact ? fmt(copy.event.noAccountContact, { contact: event.contact }) : null}
              />
              <CalendarCard
                copy={{ ...copy.event, newTab: copy.common.newTab }}
                googleHref={googleCalendarUrl(event, calendarText(event.description, calendarDetails, CALENDAR_LINK_CHARS), display.placeFull)}
                icsHref={`/api/seva/ics?id=${id}&lang=${lang}`}
              />
              <ShareCard
                copy={{ ...copy.actions, heading: copy.event.shareHeading, whatsapp: copy.event.whatsapp, newTab: copy.common.newTab }}
                url={url}
                title={event.title}
                text={`${event.title}\n${display.when}\n${display.placeShort}`}
                whatsappHref={whatsappUrl(shareMessage)}
              />
            </div>

            <div className="space-y-6 lg:col-start-1 lg:row-start-2">
              {event.description && (
                <section aria-labelledby="about-heading">
                  <h2 id="about-heading" className="text-lg font-bold text-ink">{copy.event.aboutHeading}</h2>
                  <p className="mt-2 whitespace-pre-line text-ink [overflow-wrap:anywhere]"><Mixed text={event.description} /></p>
                </section>
              )}
              <HostTools
                lang={lang}
                copy={copy.host}
                cancelCopy={copy.cancelDialog}
                volunteersCopy={copy.volunteers}
                retry={copy.common.retry}
                cancelledMessage={copy.actions.cancelledFlash}
                editHref={to(editHref(id))}
                postAgainHref={to(postAgainHref(id))}
              />
              <AdminTools copy={copy.admin} adminHref={to(ADMIN_HREF)} />
              <ReportControl copy={copy.report} />
            </div>
          </div>

          <p className="mt-10">
            <IntentLink href={to('/seva')} className="font-semibold text-accent-text underline">← {copy.event.backToList}</IntentLink>
          </p>
        </div>
      </EventProvider>
    </main>
  );
}
