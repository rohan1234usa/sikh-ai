// The rules that give each language its own URLs (#9), for next.config.ts.
// Relative imports only: next.config.ts loads this at build time.
//
// Every page lives under app/[lang] and is built once per language. English
// keeps the site's original, unprefixed URLs:
// - a rewrite serves /about from /en/about, unseen;
// - /en/… itself redirects to the unprefixed URL, so each page has one address;
// - a returning visitor whose cookie says Punjabi is sent from an unprefixed
//   page to its /pa or /pa-latn twin. Crawlers carry no cookie, so they get
//   English there and find the others through hreflang links and the sitemap.
// Rewrites and redirects run in the host's routing layer, before its cache:
// pages stay static, and no function runs to route a request.

import { DEFAULT_LANG, LANG_COOKIE, LANGS } from './config';

type Rule = {
    source: string;
    destination: string;
    has?: { type: 'cookie'; key: string; value: string }[];
};
type Redirect = Rule & { permanent: boolean };

const PREFIXED = LANGS.filter((l) => l !== DEFAULT_LANG);

// A first path segment that is a page, not a language prefix. For redirects,
// also not the API, Next's or Vercel's own paths, or a file (a dot in the
// name: og.jpg, robots.txt, sitemap.xml, favicon.ico). The lookahead ends at
// the segment's slash: a `$` would mean the end of the whole path.
const notFirst = (names: readonly string[]) => `(?!(?:${names.join('|')})(?:/|$))`;
const PAGE_SEGMENT = `${notFirst(LANGS)}[^/]+`;
const REDIRECTABLE_SEGMENT = `${notFirst([...LANGS, 'api', '_next', '_vercel'])}[^/.]+`;

export function languageRewrites(): Rule[] {
    return [
        { source: '/', destination: `/${DEFAULT_LANG}` },
        { source: `/:first(${PAGE_SEGMENT})/:rest*`, destination: `/${DEFAULT_LANG}/:first/:rest*` },
    ];
}

export function languageRedirects(): Redirect[] {
    const home: Redirect[] = PREFIXED.map((lang) => ({
        source: '/',
        has: [{ type: 'cookie', key: LANG_COOKIE, value: lang }],
        destination: `/${lang}`,
        permanent: false,
    }));
    const pages: Redirect[] = PREFIXED.map((lang) => ({
        source: `/:first(${REDIRECTABLE_SEGMENT})/:rest*`,
        has: [{ type: 'cookie', key: LANG_COOKIE, value: lang }],
        destination: `/${lang}/:first/:rest*`,
        permanent: false,
    }));
    return [
        { source: `/${DEFAULT_LANG}`, destination: '/', permanent: false },
        { source: `/${DEFAULT_LANG}/:rest*`, destination: '/:rest*', permanent: false },
        ...home,
        ...pages,
    ];
}
