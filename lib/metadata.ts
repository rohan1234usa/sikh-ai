// Link previews and canonical URLs, shared by the root layout and each page.
//
// Next merges metadata shallowly: a page that sets openGraph replaces the
// parent's whole openGraph object rather than merging with it. So every page
// builds its preview here from all its parts. The root's own preview has no
// URL; before, every page inherited the home page's title and URL.

import type { Metadata } from 'next';
import type { Dictionary } from '@/lib/i18n';
import { LANG_META, type Lang } from '@/lib/i18n/config';

export const SITE_URL = 'https://sikhai.vercel.app';

// public/og.jpg: the logo at 1200×630, about 57 KB.
const OG_IMAGE = { url: '/og.jpg', width: 1200, height: 630 } as const;

export function openGraph(lang: Lang, t: Dictionary, title: string, url?: string): NonNullable<Metadata['openGraph']> {
    return {
        title,
        description: t.meta.description,
        ...(url ? { url } : {}),
        siteName: 'SikhAI',
        images: [{ ...OG_IMAGE, alt: t.meta.ogImageAlt }],
        locale: LANG_META[lang].ogLocale,
        type: 'website',
    };
}

/**
 * A page's title, canonical URL and link preview. `path` is the page's own
 * address ('/hukamnama'), made absolute through the root's metadataBase.
 * Leave `title` out for the home page, which uses the site title.
 */
export function pageMetadata(lang: Lang, t: Dictionary, path: string, title?: string): Metadata {
    return {
        ...(title ? { title } : {}),
        alternates: { canonical: path },
        openGraph: openGraph(lang, t, title ? t.meta.titleTemplate.replace('%s', title) : t.meta.title, path),
    };
}
