import type { Metadata } from 'next';
import Link from 'next/link';
import { cache } from 'react';
import { redirect } from 'next/navigation';
import { BookOpenIcon, ChatBubbleLeftRightIcon } from '@heroicons/react/24/outline';
import ShabadHeader from '@/app/components/shabad/ShabadHeader';
import { parseAngParam } from '@/lib/gurbani/ang';
import { MAX_ANG } from '@/lib/gurbani/citations';
import { fetchAngPayload } from '@/lib/gurbani/gurbaninow';
import { normalizeVerse, type AngItem } from '@/lib/gurbani/verse';
import type { Dictionary } from '@/lib/i18n';
import { LANG_META, type Lang } from '@/lib/i18n/config';
import { fmt } from '@/lib/i18n/fmt';
import { localePath } from '@/lib/i18n/paths';
import { getServerT } from '@/lib/i18n/server';
import { SITE_URL, pageMetadata } from '@/lib/metadata';

// Every Ang of Sri Guru Granth Sahib Ji has its own page (#16), rendered on
// the server so search engines can read it. None is built ahead of time,
// which would ask GurbaniNow for all 1,430 in every build; each is built the
// first time someone opens it, then served from the CDN. Its text is kept for
// 30 days in the data cache (lib/gurbani/gurbaninow.ts), so the page is too.
export function generateStaticParams() {
  return [];
}
export const dynamicParams = true;

type Line = { gurmukhi: string; translation: string };

// The Ang's lines, or null when the source gave no usable answer. Wrapped in
// cache() so generateMetadata and the page share one request per render.
const angLines = cache(async (ang: number): Promise<Line[] | null> => {
  const data = (await fetchAngPayload(ang)) as { page?: unknown } | null;
  if (!Array.isArray(data?.page) || data.page.length === 0) return null;
  return (data.page as AngItem[]).map(normalizeVerse);
});

const angTitle = (t: Dictionary, ang: number) => `${fmt(t.shabad.angLabel, { n: ang })} · ${t.shabad.granth}`;

// The opening line, cut at a word, for the description.
function opening(lines: Line[]): string {
  const first = lines.find((l) => l.gurmukhi)?.gurmukhi ?? '';
  if (first.length <= 90) return first;
  const cut = first.slice(0, 90);
  return `${cut.slice(0, cut.lastIndexOf(' ') > 40 ? cut.lastIndexOf(' ') : 90)}…`;
}

export async function generateMetadata({ params }: PageProps<'/[lang]/shabad/[ang]'>): Promise<Metadata> {
  const ang = parseAngParam((await params).ang);
  if (ang === null) return {};
  const { lang, t } = await getServerT();
  const lines = await angLines(ang);
  const description = lines ? fmt(t.meta.angDescription, { line: opening(lines), n: ang }) : t.meta.descriptions.shabad;
  return pageMetadata(lang, t, `/shabad/${ang}`, angTitle(t, ang), description);
}

// schema.org's reading of the page: which Ang of which book, in which
// language, and where it sits in the site.
function structuredData(lang: Lang, t: Dictionary, ang: number, description: string) {
  const url = `${SITE_URL}${localePath(lang, `/shabad/${ang}`)}`;
  return {
    '@context': 'https://schema.org',
    '@type': 'WebPage',
    name: angTitle(t, ang),
    description,
    url,
    inLanguage: LANG_META[lang].htmlLang,
    isPartOf: { '@type': 'WebSite', name: 'SikhAI', url: SITE_URL },
    about: { '@type': 'Book', name: 'Sri Guru Granth Sahib Ji', inLanguage: 'pa', numberOfPages: MAX_ANG },
    breadcrumb: {
      '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: t.meta.shabadTitle, item: `${SITE_URL}${localePath(lang, '/shabad')}` },
        { '@type': 'ListItem', position: 2, name: fmt(t.shabad.angLabel, { n: ang }), item: url },
      ],
    },
  };
}

export default async function AngPage({ params }: PageProps<'/[lang]/shabad/[ang]'>) {
  const { lang, t } = await getServerT();
  const ang = parseAngParam((await params).ang);
  // Not an Ang (/shabad/1431, /shabad/abc): the Ang search. A notFound() here,
  // on a page built at its first visit, would get Next's bare 404 rather than
  // the site's (app/global-not-found.tsx only covers unmatched addresses).
  if (ang === null) redirect(localePath(lang, '/shabad'));
  const lines = await angLines(ang);
  // Thrown rather than shown, so a passing outage isn't cached as this Ang's
  // page: the error page offers Try again, and the next visit asks afresh.
  if (!lines) throw new Error(`GurbaniNow gave no usable answer for Ang ${ang}`);

  const description = fmt(t.meta.angDescription, { line: opening(lines), n: ang });
  const to = (path: string) => localePath(lang, path);
  // Escaped so a line of text can never close the script tag.
  const jsonLd = JSON.stringify(structuredData(lang, t, ang, description)).replace(/</g, '\\u003c');

  return (
    <main className="flex-1 flex flex-col">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd }} />
      <ShabadHeader t={t} ang={ang} />

      <div className="max-w-4xl mx-auto w-full p-6 flex-1 space-y-6">
        <div className="flex flex-wrap items-center gap-2 mb-4 pb-2 border-b border-edge">
          <BookOpenIcon className="w-5 h-5 text-accent-text" aria-hidden="true" />
          <h1 className="text-ink font-bold">{angTitle(t, ang)}</h1>
          <Link
            href={to(`/chat?context=shabad&ang=${ang}`)}
            className="ml-auto inline-flex items-center gap-1.5 text-sm font-semibold text-accent-text hover:underline"
          >
            <ChatBubbleLeftRightIcon className="w-4 h-4" aria-hidden="true" />
            {t.shabad.askAboutAng}
          </Link>
        </div>

        {lines.map((line, index) => (
          <div key={index} className="bg-surface-raised p-4 sm:p-6 rounded-xl shadow-sm border border-edge">
            <p lang="pa" className="text-2xl md:text-3xl text-ink font-bold text-center leading-relaxed mb-4 font-gurmukhi">
              {line.gurmukhi || t.shabad.gurmukhiUnavailable}
            </p>
            <p lang="en" className="text-ink-muted text-center italic text-lg mb-4">
              {line.translation || t.shabad.translationUnavailable}
            </p>
            <div className="flex justify-between items-center text-xs text-ink-faint border-t border-edge pt-4 mt-2">
              <span>{fmt(t.shabad.lineN, { n: index + 1 })}</span>
              <span className="uppercase tracking-widest text-accent-text font-bold">{t.shabad.granth}</span>
            </div>
          </div>
        ))}

        <div className="flex justify-between gap-4 pt-2 text-sm font-semibold">
          {ang > 1 ? (
            <Link rel="prev" href={to(`/shabad/${ang - 1}`)} className="text-accent-text hover:underline">
              ← {fmt(t.shabad.angLabel, { n: ang - 1 })}
            </Link>
          ) : <span />}
          {ang < MAX_ANG && (
            <Link rel="next" href={to(`/shabad/${ang + 1}`)} className="text-accent-text hover:underline">
              {fmt(t.shabad.angLabel, { n: ang + 1 })} →
            </Link>
          )}
        </div>
      </div>
    </main>
  );
}
