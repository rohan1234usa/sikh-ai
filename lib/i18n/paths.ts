// Each language's URLs (#9): English at the root (/about), Punjabi under its
// own prefix (/pa/about, /pa-latn/about). Every page lives under app/[lang];
// next.config.ts serves English's unprefixed URLs from /en (lib/i18n/routing.ts).
// Paths here start with '/', and may carry a query or a hash.

import { DEFAULT_LANG, isLang, type Lang } from './config';

// The URL of `path` in `lang`.
export function localePath(lang: Lang, path: string): string {
    if (lang === DEFAULT_LANG) return path;
    if (path === '/') return `/${lang}`;
    if (/^\/[?#]/.test(path)) return `/${lang}${path.slice(1)}`;
    return `/${lang}${path}`;
}

// A pathname's language, and the path within it: '/pa/chat/abc' is Punjabi's
// '/chat/abc'. The internal /en prefix counts as English too.
export function splitLocale(pathname: string): { lang: Lang; path: string } {
    const m = /^\/([^/?#]+)(.*)$/.exec(pathname);
    if (m && isLang(m[1])) return { lang: m[1], path: m[2] === '' ? '/' : m[2] };
    return { lang: DEFAULT_LANG, path: pathname || '/' };
}

// The same page in another language, query and hash kept: what the language
// picker opens.
export function switchLocale(href: string, to: Lang): string {
    const { path } = splitLocale(href);
    return localePath(to, path);
}
