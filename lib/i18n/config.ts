// Client-safe i18n configuration: site language IDs, the cookie that remembers
// a reader's choice, and per-language metadata. Dictionaries live in
// ./dictionaries. A page's language is its URL's (lib/i18n/paths.ts).

export const LANGS = ['en', 'pa', 'pa-latn'] as const;
export type Lang = (typeof LANGS)[number];

export const DEFAULT_LANG: Lang = 'en';

// Written by the language picker, read by the routing layer: a returning
// Punjabi reader who opens an unprefixed link is sent to its twin
// (lib/i18n/routing.ts). Pages themselves never read it, so they stay static.
export const LANG_COOKIE = 'sikhai.lang';
export const LANG_COOKIE_MAX_AGE = 31536000; // one year

export const isLang = (v: unknown): v is Lang => LANGS.includes(v as Lang);
export const parseLang = (v: unknown): Lang => (isLang(v) ? v : DEFAULT_LANG);

export const LANG_META: Record<Lang, {
    /** Picker label — always shown in its own language/script */
    label: string;
    /** BCP-47 value for <html lang> (drives the Gurmukhi body font via CSS) */
    htmlLang: string;
    /** openGraph.locale */
    ogLocale: string;
}> = {
    'en': { label: 'English', htmlLang: 'en', ogLocale: 'en_US' },
    'pa': { label: 'ਪੰਜਾਬੀ', htmlLang: 'pa', ogLocale: 'pa_IN' },
    'pa-latn': { label: 'Punjabi (Roman)', htmlLang: 'pa-Latn', ogLocale: 'pa_IN' },
};
