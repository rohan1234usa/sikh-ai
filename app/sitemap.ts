import type { MetadataRoute } from 'next';
import { SITE_URL } from '@/lib/metadata';

// The pages worth finding from a search. Saved chats (/chat/{id}), share
// links (/share/{id}) and the event form (/seva/create) are left out; they
// are noindex.
const PAGES: { path: string; changeFrequency?: MetadataRoute.Sitemap[number]['changeFrequency'] }[] = [
  { path: '/' },
  { path: '/hukamnama', changeFrequency: 'daily' },
  { path: '/chat' },
  { path: '/translate' },
  { path: '/shabad' },
  { path: '/seva', changeFrequency: 'daily' },
  { path: '/about' },
];

export default function sitemap(): MetadataRoute.Sitemap {
  return PAGES.map(({ path, changeFrequency }) => ({
    url: `${SITE_URL}${path === '/' ? '' : path}`,
    ...(changeFrequency ? { changeFrequency } : {}),
  }));
}
