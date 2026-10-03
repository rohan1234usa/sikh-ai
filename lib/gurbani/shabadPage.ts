// The pure parts of a shabad's page (app/[lang]/shabad/s/[shabadId]): its
// title, description, names and structured data. They live here so the tests
// can reach them; the page itself reads its language from the request.

import type { Dictionary } from '@/lib/i18n';
import { LANG_META, type Lang } from '@/lib/i18n/config';
import { fmt } from '@/lib/i18n/fmt';
import { localePath } from '@/lib/i18n/paths';
import { SITE_URL } from '@/lib/metadata';
import { MAX_ANG } from './citations';
import { opening, shabadPath, type Shabad } from './shabad';

// A writer's or raag's name: in Gurmukhi on the Gurmukhi site, in English
// letters elsewhere, and whichever there is when only one is given.
export function localName(lang: Lang, english: string, gurmukhi: string): string {
    return (lang === 'pa' && gurmukhi) || english || gurmukhi;
}

// The line a shabad is known by: its first verse, past the headings, without
// the closing dandas and verse number.
export function firstVerse(shabad: Shabad): string {
    const line = shabad.lines.find(l => l.kind === 'verse') ?? shabad.lines[0];
    return line.gurmukhi.replace(/[\s।॥੦-੯]+$/u, '');
}

// "Ang 10", or "Angs 10–11" for a shabad that runs onto the next Ang.
export function shabadAngs(t: Dictionary, shabad: Shabad): string {
    if (shabad.ang === null) return '';
    if (shabad.angEnd === null || shabad.angEnd === shabad.ang) return fmt(t.shabad.angLabel, { n: shabad.ang });
    return fmt(t.shabad.page.angSpan, { from: shabad.ang, to: shabad.angEnd });
}

// Every Ang the shabad is on, for links to those Ang pages.
export function shabadAngList(shabad: Shabad): number[] {
    if (shabad.ang === null) return [];
    const last = shabad.angEnd ?? shabad.ang;
    return Array.from({ length: last - shabad.ang + 1 }, (_, i) => (shabad.ang as number) + i);
}

export function shabadTitle(t: Dictionary, shabad: Shabad): string {
    const line = opening(firstVerse(shabad), 60);
    return shabad.ang === null ? line : fmt(t.shabad.page.title, { line, n: shabad.ang });
}

export function shabadDescription(t: Dictionary, shabad: Shabad): string {
    return fmt(t.meta.shabadDescription, { line: opening(firstVerse(shabad)), n: shabad.ang ?? '' });
}

// schema.org's reading of the page: one shabad, by its writer, within Sri
// Guru Granth Sahib Ji, and where the page sits in the site.
export function shabadStructuredData(lang: Lang, t: Dictionary, shabad: Shabad, description: string) {
    const url = `${SITE_URL}${localePath(lang, shabadPath(shabad.id))}`;
    const name = shabadTitle(t, shabad);
    const crumbs = [
        { name: t.meta.shabadTitle, item: `${SITE_URL}${localePath(lang, '/shabad')}` },
        ...(shabad.ang === null ? [] : [{ name: fmt(t.shabad.angLabel, { n: shabad.ang }), item: `${SITE_URL}${localePath(lang, `/shabad/${shabad.ang}`)}` }]),
        { name, item: url },
    ];
    return {
        '@context': 'https://schema.org',
        '@type': 'WebPage',
        name,
        description,
        url,
        inLanguage: LANG_META[lang].htmlLang,
        isPartOf: { '@type': 'WebSite', name: 'SikhAI', url: SITE_URL },
        about: {
            '@type': 'CreativeWork',
            name: firstVerse(shabad),
            inLanguage: 'pa',
            ...(shabad.writer ? { author: { '@type': 'Person', name: shabad.writer } } : {}),
            isPartOf: { '@type': 'Book', name: 'Sri Guru Granth Sahib Ji', inLanguage: 'pa', numberOfPages: MAX_ANG },
        },
        breadcrumb: {
            '@type': 'BreadcrumbList',
            itemListElement: crumbs.map((crumb, i) => ({ '@type': 'ListItem', position: i + 1, ...crumb })),
        },
    };
}

// Structured data as a script's text: escaped so a line of text can never
// close the script tag.
export const jsonLdText = (data: object): string => JSON.stringify(data).replace(/</g, '\\u003c');
