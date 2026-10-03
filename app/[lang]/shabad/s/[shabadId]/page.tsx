import type { Metadata } from 'next';
import { cache } from 'react';
import { redirect } from 'next/navigation';
import IntentLink from '@/app/components/IntentLink';
import LineHighlight from '@/app/components/shabad/LineHighlight';
import ShabadHeader from '@/app/components/shabad/ShabadHeader';
import SourceNote from '@/app/components/shabad/SourceNote';
import ShabadVerse from '@/app/components/shabad/ShabadVerse';
import { SGGS_SOURCE_ID } from '@/lib/gurbani/citations';
import { fetchShabad } from '@/lib/gurbani/gurbaninow';
import { localName, parseShabadIdParam, shabadPath, shabadSections } from '@/lib/gurbani/shabad';
import {
  jsonLdText, shabadAngList, shabadAngs, shabadDescription, shabadStructuredData, shabadTitle,
} from '@/lib/gurbani/shabadPage';
import { fmt } from '@/lib/i18n/fmt';
import { localePath } from '@/lib/i18n/paths';
import { getServerT } from '@/lib/i18n/server';
import { pageMetadata } from '@/lib/metadata';

// Every shabad of Sri Guru Granth Sahib Ji has its own page, whole even
// where it runs onto the next Ang: Shabad Search leads here, to the line that
// was searched for (#line-{id}). Like the Ang pages, none is built ahead of
// time; each is built the first time someone opens it, then served from the
// CDN. Its text is kept for 30 days in the data cache
// (lib/gurbani/gurbaninow.ts), so the page is too.
export function generateStaticParams() {
  return [];
}
export const dynamicParams = true;

// Wrapped in cache() so generateMetadata and the page share one request per
// render.
const loadShabad = cache((id: string) => fetchShabad(id));

export async function generateMetadata({ params }: PageProps<'/[lang]/shabad/s/[shabadId]'>): Promise<Metadata> {
  const id = parseShabadIdParam((await params).shabadId);
  if (id === null) return {};
  const { lang, t } = await getServerT();
  const shabad = await loadShabad(id);
  if (!shabad || shabad.source.id !== SGGS_SOURCE_ID) return {};
  return pageMetadata(lang, t, shabadPath(id), shabadTitle(t, shabad), shabadDescription(t, shabad));
}

export default async function ShabadPage({ params }: PageProps<'/[lang]/shabad/s/[shabadId]'>) {
  const { lang, t } = await getServerT();
  const id = parseShabadIdParam((await params).shabadId);
  // Not a shabad's id (/shabad/s/abc): the search. A notFound() here, on a
  // page built at its first visit, would get Next's bare 404 rather than the
  // site's (app/global-not-found.tsx only covers unmatched addresses).
  if (id === null) redirect(localePath(lang, '/shabad'));
  const shabad = await loadShabad(id);
  // Thrown rather than shown, so a passing outage isn't cached as this
  // shabad's page: the error page offers Try again. GurbaniNow answers an id
  // it doesn't know just as it answers a fault, so that ends up here too.
  if (!shabad) throw new Error(`GurbaniNow gave no usable answer for shabad ${id}`);
  // Only Sri Guru Granth Sahib Ji's shabads, whose Angs this site reads. A
  // shabad's source never changes, so this answer can be kept.
  if (shabad.source.id !== SGGS_SOURCE_ID) redirect(localePath(lang, '/shabad'));

  const to = (path: string) => localePath(lang, path);
  const sections = shabadSections(shabad.lines);
  const title = shabadTitle(t, shabad);
  const about = [localName(lang, shabad.writer, shabad.writerGurmukhi), localName(lang, shabad.raag, shabad.raagGurmukhi)]
    .filter(Boolean).join(' · ');

  return (
    <main className="flex-1 flex flex-col">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdText(shabadStructuredData(lang, t, shabad, shabadDescription(t, shabad))) }} />
      <LineHighlight />
      <ShabadHeader t={t} page="shabad" />

      <div className="max-w-4xl mx-auto w-full p-4 md:p-8 flex-1">
        <h1 className="sr-only">{title}</h1>
        <article className="bg-surface-raised shadow-xl rounded-2xl overflow-hidden border-t-8 border-kesri">
          <header className="bg-surface px-6 py-6 md:py-8 text-center border-b border-edge space-y-2">
            <p className="text-accent-text uppercase tracking-widest text-xs font-bold">
              {t.shabad.page.label} · {shabadAngs(t, shabad)}
            </p>
            {about && <p lang={lang === 'pa' ? 'pa' : undefined} className="text-ink font-semibold">{about}</p>}
            <p className="flex flex-wrap justify-center gap-x-4 gap-y-1 text-sm font-semibold">
              {shabadAngList(shabad).map((n) => (
                <IntentLink key={n} href={to(`/shabad/${n}`)} className="text-accent-text hover:underline">
                  {fmt(t.shabad.angLabel, { n })}
                </IntentLink>
              ))}
            </p>
          </header>

          <div className="px-3 py-4 md:px-10 md:py-8">
            {sections.map((section, i) => (
              <section key={`${section.ang}-${i}`}>
                {sections.length > 1 && section.ang !== null && (
                  <h2 className="flex items-center gap-3 my-4 text-xs font-bold uppercase tracking-widest">
                    <span className="h-px flex-1 bg-edge" aria-hidden="true" />
                    <IntentLink href={to(`/shabad/${section.ang}`)} className="text-accent-text hover:underline">
                      {fmt(t.shabad.angLabel, { n: section.ang })}
                    </IntentLink>
                    <span className="h-px flex-1 bg-edge" aria-hidden="true" />
                  </h2>
                )}
                <div className="space-y-2">
                  {section.lines.map((line) => <ShabadVerse key={line.id} line={line} />)}
                </div>
              </section>
            ))}
          </div>

          <footer className="border-t border-edge bg-surface px-6 py-5 space-y-4">
            {(shabad.previousId || shabad.nextId) && (
              <nav aria-label={t.shabad.page.navAria} className="flex justify-between gap-4 text-sm font-semibold">
                {shabad.previousId ? (
                  <IntentLink rel="prev" href={to(shabadPath(shabad.previousId))} className="text-accent-text hover:underline">
                    ← {t.shabad.page.previous}
                  </IntentLink>
                ) : <span />}
                {shabad.nextId && (
                  <IntentLink rel="next" href={to(shabadPath(shabad.nextId))} className="text-accent-text hover:underline">
                    {t.shabad.page.next} →
                  </IntentLink>
                )}
              </nav>
            )}
            <SourceNote t={t} />
          </footer>
        </article>
      </div>
    </main>
  );
}
