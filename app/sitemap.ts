import type { MetadataRoute } from 'next';
import { LANGS } from '@/lib/i18n/config';
import { localePath } from '@/lib/i18n/paths';
import { SITE_URL, languageAlternates } from '@/lib/metadata';

// The pages worth finding from a search, in each language, each listing its
// twins in the others (hreflang), so the Gurmukhi and romanized Punjabi pages
// get found too. Saved chats (/chat/{id}), share links (/share/{id}) and the
// event form (/seva/create) are left out; they are noindex.
const PAGES: { path: string; changeFrequency?: MetadataRoute.Sitemap[number]['changeFrequency'] }[] = [
  { path: '/' },
  { path: '/hukamnama', changeFrequency: 'daily' },
  { path: '/chat' },
  { path: '/translate' },
  { path: '/shabad' },
  { path: '/seva', changeFrequency: 'daily' },
  { path: '/about' },
];

const absolute = (path: string) => `${SITE_URL}${path === '/' ? '' : path}`;

export default function sitemap(): MetadataRoute.Sitemap {
  return PAGES.flatMap(({ path, changeFrequency }) => {
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
