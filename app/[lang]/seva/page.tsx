import type { Metadata } from 'next';
import IntentLink from '@/app/components/IntentLink';
import { PRIMARY_BUTTON } from '@/app/components/buttons';
import EventCard from '@/app/components/seva/EventCard';
import SevaBoard, { type BoardGroup } from '@/app/components/seva/SevaBoard';
import SevaHero from '@/app/components/seva/SevaHero';
import YourSevaPanel from '@/app/components/seva/YourSevaPanel';
import { localePath } from '@/lib/i18n/paths';
import { getSevaCopy } from '@/lib/i18n/seva';
import { getServerT } from '@/lib/i18n/server';
import { pageMetadata } from '@/lib/metadata';
import { ADMIN_HREF, CREATE_HREF, eventHref } from '@/lib/seva/config';
import { countryName } from '@/lib/seva/countries';
import { describeEvent } from '@/lib/seva/display';
import { facetsOf, groupByDay, upcoming } from '@/lib/seva/listing';
import type { SevaEvent } from '@/lib/seva/model';
import { fetchUpcomingEvents, isBuilding, renderTime, sevaProject } from '@/lib/seva/server';
import { formatDayKey } from '@/lib/seva/time';

// The board: every seva still to come, soonest first, as the server reads it
// from Firestore (lib/seva/server.ts). The page is cached for five minutes,
// and built again at once after a change made here (app/api/seva/refresh), so
// a visitor's browser never talks to Firebase to see it. Each card leads to
// its event's page, where people join, share and add it to a calendar.
export const revalidate = 300; // SEVA_REVALIDATE_SECONDS

export async function generateMetadata(): Promise<Metadata> {
  const { lang, t } = await getServerT();
  const copy = getSevaCopy(lang);
  return pageMetadata(lang, t, '/seva', copy.meta.title, copy.meta.description);
}

export default async function SevaBoardPage() {
  const { lang } = await getServerT();
  const copy = getSevaCopy(lang);
  const to = (path: string) => localePath(lang, path);
  const now = renderTime();

  const read = await fetchUpcomingEvents(now);
  // Once the site is live, a passing outage is thrown, so the board that was
  // there keeps being served; while building (CI has no network) or with no
  // project set up, it's shown as unavailable.
  if (read.kind === 'failed' && !isBuilding() && sevaProject()) {
    throw new Error('Firestore gave no usable answer for the Seva board');
  }
  const events = read.kind === 'ok' ? upcoming(read.value, now) : null;

  const card = (event: SevaEvent, showDate: boolean) => (
    <EventCard event={event} display={describeEvent(event, lang, copy)} href={to(eventHref(event.id))} copy={copy.common} showDate={showDate} />
  );
  const item = (event: SevaEvent, showDate: boolean) => ({ id: event.id, facets: facetsOf(event), card: card(event, showDate) });

  let groups: BoardGroup[] = [];
  const countryNames: Record<string, string> = {};
  if (events) {
    const { now: underWay, days } = groupByDay(events, now);
    groups = [
      ...(underWay.length ? [{ key: 'now', heading: copy.common.happeningNow, items: underWay.map((e) => item(e, true)) }] : []),
      ...days.map((day) => ({ key: day.key, heading: formatDayKey(day.key, lang), dateTime: day.key, items: day.events.map((e) => item(e, false)) })),
    ];
    for (const e of events) if (e.country) countryNames[e.country] ??= countryName(e.country, lang);
  }

  return (
    <main className="flex-1 flex flex-col">
      <SevaHero lang={lang} copy={copy.board} hostHref={to(CREATE_HREF)} angHref={to('/shabad/26')} />

      <div className="mx-auto w-full max-w-4xl space-y-8 px-4 py-8 sm:px-6">
        <YourSevaPanel
          lang={lang}
          copy={copy.mine}
          labels={{ cancelled: copy.common.cancelled, hidden: copy.common.hidden, full: copy.common.full, retry: copy.common.retry }}
          eventBase={to('/seva/')}
          adminHref={to(ADMIN_HREF)}
        />
        {events === null ? (
          <div className="rounded-xl border border-edge bg-surface-raised p-6 text-center shadow-sm">
            <h2 className="text-lg font-bold text-ink">{copy.board.unavailableTitle}</h2>
            <p className="mt-1 text-ink-muted">{copy.board.unavailableBody}</p>
            <a href={to('/seva')} className="mt-4 inline-block font-semibold text-accent-text underline">{copy.common.retry}</a>
          </div>
        ) : events.length === 0 ? (
          <div className="rounded-xl border border-edge bg-surface-raised p-6 text-center shadow-sm">
            <h2 className="text-lg font-bold text-ink">{copy.board.emptyTitle}</h2>
            <p className="mt-1 text-ink-muted">{copy.board.emptyBody}</p>
            <IntentLink href={to(CREATE_HREF)} className={`mt-4 ${PRIMARY_BUTTON}`}>{copy.board.hostCta}</IntentLink>
          </div>
        ) : (
          <SevaBoard
            lang={lang}
            groups={groups}
            totalTemplate={copy.board.total}
            timesLocal={copy.board.timesLocal}
            copy={copy.filters}
            countryNames={countryNames}
            categoryNames={copy.common.categories}
            createHref={to(CREATE_HREF)}
          />
        )}

        {events !== null && events.length > 0 && (
          <p className="rounded-xl border border-dashed border-edge-strong p-5 text-center text-ink-muted">
            {copy.board.hostPrompt}{' '}
            <IntentLink href={to(CREATE_HREF)} className="font-semibold text-accent-text underline">{copy.board.hostPromptCta}</IntentLink>
          </p>
        )}
      </div>
    </main>
  );
}
