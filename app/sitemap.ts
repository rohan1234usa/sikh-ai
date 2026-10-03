import type { MetadataRoute } from 'next';
import { MAX_ANG } from '@/lib/gurbani/citations';
import { LANGS } from '@/lib/i18n/config';
import { learnPaths } from '@/lib/learn/config';
import { localePath } from '@/lib/i18n/paths';
import { SITE_URL, languageAlternates } from '@/lib/metadata';
import { eventHref } from '@/lib/seva/config';
import { upcoming } from '@/lib/seva/listing';
import { fetchUpcomingEvents, renderTime } from '@/lib/seva/server';

// The pages worth finding from a search, in each language, each listing its
// twins in the others (hreflang), so the Gurmukhi and romanized Punjabi pages
// get found too: the site's pages, every Learn Punjabi lesson and topic, then
// every Ang (/shabad/1 … /shabad/1430), whose text never changes, and every
// seva still to come (from the board's cached list; none if it can't be
// read). Saved chats (/chat/{id}), share links (/share/{id}) and the Seva
// forms are left out; they are noindex.
const PAGES: { path: string; changeFrequency?: MetadataRoute.Sitemap[number]['changeFrequency'] }[] = [
  { path: '/' },
  { path: '/hukamnama', changeFrequency: 'daily' },
  { path: '/chat' },
  { path: '/translate' },
  ...learnPaths().map((path) => ({ path })),
  { path: '/shabad' },
  { path: '/seva', changeFrequency: 'daily' },
  { path: '/about' },
  { path: '/privacy', changeFrequency: 'yearly' },
  { path: '/terms', changeFrequency: 'yearly' },
  ...Array.from({ length: MAX_ANG }, (_, i) => ({ path: `/shabad/${i + 1}`, changeFrequency: 'yearly' as const })),
];

const absolute = (path: string) => `${SITE_URL}${path === '/' ? '' : path}`;

// Rebuilt with the board, so new events are listed within minutes.
export const revalidate = 300; // SEVA_REVALIDATE_SECONDS

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = renderTime();
  const read = await fetchUpcomingEvents(now);
  const events = read.kind === 'ok' ? upcoming(read.value, now) : [];
  const pages = [...PAGES, ...events.map((e) => ({ path: eventHref(e.id), changeFrequency: 'daily' as const }))];
  return pages.flatMap(({ path, changeFrequency }) => {
    const languages = Object.fromEntries(
      Object.entries(languageAlternates(path)).map(([hreflang, href]) => [hreflang, absolute(href)]),
    );
    return LANGS.map((lang) => ({
      url: absolute(localePath(lang, path)),
      ...(changeFrequency ? { changeFrequency } : {}),
      alternates: { languages },
    }));
  });
}
