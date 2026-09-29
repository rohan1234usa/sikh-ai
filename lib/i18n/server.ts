// Server-side language access for server components and generateMetadata.
// The language is the URL's: every page lives under app/[lang] (English's
// URLs have no prefix; next.config.ts serves them from /en). Reading it as a
// root param, not from a cookie, is what lets each page be built ahead of
// time, once per language, and served from the CDN.

import { lang as langParam } from 'next/root-params';
import { parseLang, type Lang } from './config';
import { getDictionary, type Dictionary } from './index';

export async function getLang(): Promise<Lang> {
    return parseLang(await langParam());
}

export async function getServerT(): Promise<{ lang: Lang; t: Dictionary }> {
    const lang = await getLang();
    return { lang, t: getDictionary(lang) };
}
