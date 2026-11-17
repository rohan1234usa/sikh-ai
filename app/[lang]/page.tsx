import type { Metadata } from 'next';
import IntentLink from '@/app/components/IntentLink';
import {
  AcademicCapIcon,
  ChatBubbleLeftRightIcon,
  SunIcon,
  MagnifyingGlassIcon,
  UserGroupIcon,
  LanguageIcon,
  ArrowRightIcon,
} from '@heroicons/react/24/outline';
import { BUTTON_LG, PRIMARY_BUTTON } from '@/app/components/buttons';
import HukamnamaHeader from '@/app/components/gurbani/HukamnamaHeader';
import Tukk from '@/app/components/gurbani/Tukk';
import SourceNote from '@/app/components/shabad/SourceNote';
import UpcomingSevaStrip from '@/app/components/seva/UpcomingSevaStrip';
import { fetchHukamnama } from '@/lib/gurbani/gurbaninow';
import { localePath } from '@/lib/i18n/paths';
import { getSevaCopy } from '@/lib/i18n/seva';
import { getServerT } from '@/lib/i18n/server';
import { pageMetadata } from '@/lib/metadata';
import { HOME_STRIP_COUNT } from '@/lib/seva/config';
import { upcoming } from '@/lib/seva/listing';
import { fetchUpcomingEvents, renderTime } from '@/lib/seva/server';

// Icons and routes live in code; titles/descriptions/CTAs come from the
// dictionary keyed by the same names.
const FEATURE_LINKS = [
  { key: 'chat', href: '/chat', Icon: ChatBubbleLeftRightIcon },
  { key: 'translate', href: '/translate', Icon: LanguageIcon },
  { key: 'learn', href: '/learn', Icon: AcademicCapIcon },
  { key: 'hukamnama', href: '/hukamnama', Icon: SunIcon },
  { key: 'shabad', href: '/shabad', Icon: MagnifyingGlassIcon },
  { key: 'seva', href: '/seva', Icon: UserGroupIcon },
] as const;

// How much of today's Hukamnama the home page shows: its opening verses, read
// whole and verbatim (GurbaniNow's licence allows no changes), with the rest a
// link away.
const HOME_VERSES = 4;

// The page is built ahead of time and again every five minutes, for the Seva
// strip's sake: it shares the board's cached list (lib/seva/server.ts). The
// Hukamnama is cached for ten (lib/gurbani/gurbaninow.ts), which doesn't
// lower that.
export const revalidate = 300; // SEVA_REVALIDATE_SECONDS

export async function generateMetadata(): Promise<Metadata> {
  const { lang, t } = await getServerT();
  return pageMetadata(lang, t, '/');
}

export default async function Home() {
  const { lang, t } = await getServerT();
  const to = (path: string) => localePath(lang, path);
  // The next few seva and today's Hukamnama, read side by side. Neither read
  // throws: a part that can't be read is left out rather than failing the page.
  const now = renderTime();
  const [read, hukamnama] = await Promise.all([fetchUpcomingEvents(now), fetchHukamnama()]);
  const nextSeva = read.kind === 'ok' ? upcoming(read.value, now).slice(0, HOME_STRIP_COUNT) : null;
  const verses = hukamnama ? hukamnama.lines.filter((line) => line.kind === 'verse').slice(0, HOME_VERSES) : [];

  return (
    <main className="flex-1 flex flex-col">
      {/* What the site is, briefly; then the day's Hukam, the page's real subject. */}
      <section className="px-6 pt-14 pb-10 text-center md:pt-20">
        <div className="mx-auto max-w-3xl space-y-5 animate-fade-up">
          <h1 className="text-4xl font-semibold leading-tight text-ink text-balance md:text-6xl">
            {t.home.heroLine1} <span className="text-accent-text">{t.home.heroLine2}</span>
          </h1>
          <p className="mx-auto max-w-xl text-lg leading-relaxed text-ink-muted">{t.home.heroSubtitle}</p>
          <div className="flex justify-center pt-2">
            <IntentLink href={to('/chat')} className={`${PRIMARY_BUTTON} ${BUTTON_LG}`}>
              {t.home.ctaChat}
              <ArrowRightIcon className="w-5 h-5" aria-hidden="true" />
            </IntentLink>
          </div>
        </div>
      </section>

      {hukamnama && verses.length > 0 && (
        <section className="px-4 pb-16">
          <div className="mx-auto max-w-3xl border border-edge">
            <HukamnamaHeader hukamnama={hukamnama} lang={lang} t={t} level="h2" />
            <div className="space-y-8 px-4 py-10 md:px-10">
              {verses.map((line) => (
                <Tukk
                  key={line.id}
                  size="page"
                  gurmukhi={line.gurmukhi}
                  transliteration={line.transliteration}
                  translation={line.translation}
                />
              ))}
            </div>
            <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-3 border-t border-edge px-6 pt-6 text-sm font-semibold">
              <IntentLink href={to('/hukamnama')} className="inline-flex items-center gap-1 text-link hover:underline">
                {t.home.ctaHukamnama}
                <ArrowRightIcon className="h-4 w-4" aria-hidden="true" />
              </IntentLink>
              <IntentLink href={to('/chat?context=hukamnama')} className="inline-flex items-center gap-1.5 text-link hover:underline">
                <ChatBubbleLeftRightIcon className="h-4 w-4" aria-hidden="true" />
                {t.hukamnama.discussCta}
              </IntentLink>
            </div>
            <div className="px-6 pt-4 pb-6">
              <SourceNote t={t} />
            </div>
          </div>
        </section>
      )}

      {nextSeva && <UpcomingSevaStrip lang={lang} copy={getSevaCopy(lang)} events={nextSeva} />}

      <section className="border-t border-edge px-6 py-16 md:py-20">
        <div className="mx-auto max-w-6xl">
          <div className="mx-auto mb-10 max-w-2xl text-center">
            <h2 className="text-3xl font-semibold text-ink md:text-4xl">{t.home.exploreTitle}</h2>
            <p className="mt-3 text-ink-muted">{t.home.exploreSubtitle}</p>
          </div>

          {/* Equal cells, as in a pangat: every feature the same size, none
              set above another. Six fill one, two and three columns evenly. */}
          <ul className="grid border-l border-t border-edge sm:grid-cols-2 lg:grid-cols-3">
            {FEATURE_LINKS.map(({ key, href, Icon }) => {
              const feature = t.home.features[key];
              return (
                <li key={href} className="border-b border-r border-edge">
                  <IntentLink
                    href={to(href)}
                    className="flex h-full flex-col gap-3 p-6 transition-colors hover:bg-surface-raised"
                  >
                    <Icon className="w-6 h-6 text-accent-text" aria-hidden="true" />
                    <h3 className="text-lg font-semibold text-ink">{feature.title}</h3>
                    <p className="text-sm leading-relaxed text-ink-muted">{feature.desc}</p>
                    <span className="mt-auto inline-flex items-center gap-1 pt-2 text-sm font-semibold text-link">
                      {feature.cta}
                      <ArrowRightIcon className="w-4 h-4" aria-hidden="true" />
                    </span>
                  </IntentLink>
                </li>
              );
            })}
          </ul>
        </div>
      </section>
    </main>
  );
}
