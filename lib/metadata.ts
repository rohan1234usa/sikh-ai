// Link previews and canonical URLs, shared by the root layout and each page.
//
// Next merges metadata shallowly: a page that sets openGraph replaces the
// parent's whole openGraph object rather than merging with it. So every page
// builds its preview here from all its parts. The root's own preview has no
// URL; before, every page inherited the home page's title and URL.

import type { Metadata } from 'next';
import type { Dictionary } from '@/lib/i18n';
import { LANGS, LANG_META, type Lang } from '@/lib/i18n/config';
import { localePath } from '@/lib/i18n/paths';

export const SITE_URL = 'https://sikhai.vercel.app';

// public/og.jpg: the logo at 1200×630, about 57 KB.
const OG_IMAGE = { url: '/og.jpg', width: 1200, height: 630 } as const;

export function openGraph(lang: Lang, t: Dictionary, title: string, url?: string, description = t.meta.description): NonNullable<Metadata['openGraph']> {
    return {
        title,
        description,
        ...(url ? { url } : {}),
        siteName: 'SikhAI',
        images: [{ ...OG_IMAGE, alt: t.meta.ogImageAlt }],
        locale: LANG_META[lang].ogLocale,
        type: 'website',
    };
}

// A page's address in every language, keyed by hreflang ('en', 'pa',
// 'pa-Latn'), plus x-default, the unprefixed English address. Search engines
// treat the three as one page and show each reader their own language's.
export function languageAlternates(path: string): Record<string, string> {
    return {
        ...Object.fromEntries(LANGS.map((lang) => [LANG_META[lang].htmlLang, localePath(lang, path)])),
        'x-default': path,
    };
}

/**
 * A page's title, description, canonical URL, language alternates and link
 * preview. `path` is the page's address without a language prefix
 * ('/hukamnama'); the canonical URL is this language's ('/pa/hukamnama'),
 * made absolute through the root's metadataBase. Leave `title` out for the
 * home page, which uses the site title, and `description` for the site's.
 *
 * The title carries the site's template along with it. A layout's plain
 * string title would stop the root's template from reaching the pages below
 * it (each Ang under /shabad, /seva/create), and a page reads `default`
 * through its parent's template just as it would a string.
 */
export function pageMetadata(lang: Lang, t: Dictionary, path: string, title?: string, description?: string): Metadata {
    const url = localePath(lang, path);
    return {
        ...(title ? { title: { default: title, template: t.meta.titleTemplate } } : {}),
        ...(description ? { description } : {}),
        alternates: { canonical: url, languages: languageAlternates(path) },
        openGraph: openGraph(lang, t, title ? t.meta.titleTemplate.replace('%s', title) : t.meta.title, url, description),
    };
}
