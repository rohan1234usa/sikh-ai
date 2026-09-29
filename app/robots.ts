import type { MetadataRoute } from 'next';
import { SITE_URL } from '@/lib/metadata';

// Only the API is off limits. Saved chats, share links and the event form
// stay crawlable on purpose: each carries a noindex tag, and a crawler has to
// fetch the page to read it. A page blocked here could still be listed, as a
// bare URL, from someone else's link.
export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: '*', allow: '/', disallow: '/api/' },
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
