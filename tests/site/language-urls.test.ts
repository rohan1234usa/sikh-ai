import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import sitemap from '@/app/sitemap';
import { localePath, splitLocale, switchLocale } from '@/lib/i18n/paths';
import { learnPaths } from '@/lib/learn/config';
import { languageRedirects, languageRewrites } from '@/lib/i18n/routing';

test('English keeps its unprefixed URLs; Punjabi gets its prefix', () => {
    assert.equal(localePath('en', '/about'), '/about');
    assert.equal(localePath('en', '/'), '/');
    assert.equal(localePath('pa', '/about'), '/pa/about');
    assert.equal(localePath('pa', '/'), '/pa');
    assert.equal(localePath('pa', '/?q=1'), '/pa?q=1');
    assert.equal(localePath('pa-latn', '/chat?context=hukamnama'), '/pa-latn/chat?context=hukamnama');
});

test("a pathname's language and the page within it", () => {
    assert.deepEqual(splitLocale('/pa/chat/abc'), { lang: 'pa', path: '/chat/abc' });
    assert.deepEqual(splitLocale('/pa'), { lang: 'pa', path: '/' });
    assert.deepEqual(splitLocale('/pa-latn/seva/create'), { lang: 'pa-latn', path: '/seva/create' });
    assert.deepEqual(splitLocale('/about'), { lang: 'en', path: '/about' });
    assert.deepEqual(splitLocale('/'), { lang: 'en', path: '/' });
    assert.deepEqual(splitLocale('/paath'), { lang: 'en', path: '/paath' }, 'a page that starts like a prefix');
    assert.deepEqual(splitLocale('/en/about'), { lang: 'en', path: '/about' }, 'the internal prefix');
});

test('the language picker opens the same page in the other language', () => {
    assert.equal(switchLocale('/pa/chat/abc', 'en'), '/chat/abc');
    assert.equal(switchLocale('/about', 'pa-latn'), '/pa-latn/about');
    assert.equal(switchLocale('/pa-latn', 'pa'), '/pa');
});

// Each rule's source, as Next matches it: with Next's own copy of
// path-to-regexp, which ships without types.
const { pathToRegexp, compile } = createRequire(import.meta.url)('next/dist/compiled/path-to-regexp') as {
    pathToRegexp: (source: string, keys?: { name: string | number }[]) => RegExp;
    compile: (path: string, options: { validate: boolean }) => (params: Record<string, string>) => string;
};
const matches = (source: string, path: string) => pathToRegexp(source).test(path);

// Where the host sends a request, as Vercel runs these rules: the first
// redirect whose source and cookie match, its destination written with $1, $2…
// for the source's groups, and a group that matched nothing (an empty :rest*)
// filled in as ''. Next's own server leaves such a parameter out instead, so
// `next start` can't show what this catches (#44).
function hostRedirect(path: string, cookie?: string): string | null {
    for (const rule of languageRedirects()) {
        if (rule.has && !rule.has.every((h) => h.value === cookie)) continue;
        const keys: { name: string | number }[] = [];
        const match = pathToRegexp(rule.source, keys).exec(path);
        if (!match) continue;
        const numbered = compile(rule.destination, { validate: false })(
            Object.fromEntries(keys.map((key, i) => [key.name, `$${i + 1}`])),
        );
        return numbered.replace(/\$(\d+)/g, (_, n: string) => match[Number(n)] ?? '');
    }
    return null;
}

test('English URLs are served from /en; a language prefix never is', () => {
    const [home, pages] = languageRewrites();
    assert.equal(home.source, '/');
    assert.equal(home.destination, '/en');
    for (const path of ['/about', '/chat', '/chat/abc-123', '/seva/create', '/nope', '/paath', '/shabad/s/823', '/shabad/10'])
        assert.ok(matches(pages.source, path), path);
    for (const path of ['/pa', '/pa/about', '/pa-latn', '/pa-latn/chat/x', '/en', '/en/about'])
        assert.ok(!matches(pages.source, path), path);
});

test('a Punjabi cookie redirects pages, never files, the API or Next and Vercel paths', () => {
    const cookiePages = languageRedirects().filter((r) => r.has && r.source !== '/');
    assert.deepEqual([...new Set(cookiePages.map((r) => r.has![0].value))], ['pa', 'pa-latn']);
    for (const lang of ['pa', 'pa-latn']) {
        const rules = cookiePages.filter((r) => r.has![0].value === lang);
        const redirected = (path: string) => rules.some((r) => matches(r.source, path));
        for (const path of ['/about', '/chat/abc-123', '/seva/create', '/shabad/s/823'])
            assert.ok(redirected(path), `${path} (${lang})`);
        // Vercel's analytics paths have no file extension to protect them, so
        // only the _vercel exclusion keeps a Punjabi reader's visits counting.
        // (Vercel also serves them at a per-build /<random>/ path, before these
        // rules run.)
        for (const path of ['/og.jpg', '/robots.txt', '/sitemap.xml', '/favicon.ico', '/manifest.webmanifest',
            '/icon-192.png', '/icons/app.png', '/fonts/a/b.woff2', '/api/chat', '/api/shabad', '/api/shabad/search',
            '/_next/static/chunks/a.js', '/_vercel/speed-insights/script.js', '/_vercel/speed-insights/vitals',
            '/_vercel/insights/script.js', '/_vercel/insights/view', '/_vercel/insights/event',
            '/pa/about', '/pa-latn', '/en/about'])
            assert.ok(!redirected(path), `${path} (${lang})`);
    }
    assert.ok(cookiePages.every((r) => !r.permanent), 'a choice can change, so never cached as permanent');
});

test("a returning Punjabi reader reaches a page's own address in one redirect (#44)", () => {
    for (const lang of ['pa', 'pa-latn']) {
        assert.equal(hostRedirect('/', lang), `/${lang}`);
        for (const path of ['/about', '/hukamnama', '/privacy', '/chat/abc-123', '/seva/create', '/shabad/s/823', '/learn/vocab/family']) {
            const to = hostRedirect(path, lang);
            assert.equal(to, `/${lang}${path}`, `${path} (${lang})`);
            assert.equal(hostRedirect(to!, lang), null, `${to} is where it stays`);
        }
    }
    // An address ending in a slash would be redirected once more, permanently,
    // to the one without: no rule sends a browser to one.
    for (const cookie of [undefined, 'en', 'pa', 'pa-latn']) {
        for (const path of ['/', '/about', '/chat', '/chat/abc', '/en', '/en/about', '/en/chat/abc', '/pa', '/pa/about']) {
            const to = hostRedirect(path, cookie);
            assert.ok(to === null || to === '/' || !to.endsWith('/'), `${path} (${cookie}) → ${to}`);
        }
    }
});

test('/en is never a public address', () => {
    const redirects = languageRedirects();
    assert.ok(redirects.some((r) => r.source === '/en' && r.destination === '/'));
    assert.ok(redirects.some((r) => r.source === '/en/:rest*' && r.destination === '/:rest*' && !r.has));
});

test('the sitemap lists every page and every Ang in every language, each with its twins', async () => {
    // No Firebase project here, so no events: just the pages.
    const entries = await sitemap();
    assert.equal(entries.length, (9 + learnPaths().length + 1430) * 3);
    const hukamnama = entries.find((e) => e.url === 'https://sikhai.vercel.app/pa/hukamnama')!;
    assert.deepEqual(hukamnama.alternates?.languages, {
        en: 'https://sikhai.vercel.app/hukamnama',
        pa: 'https://sikhai.vercel.app/pa/hukamnama',
        'pa-Latn': 'https://sikhai.vercel.app/pa-latn/hukamnama',
        'x-default': 'https://sikhai.vercel.app/hukamnama',
    });
    assert.ok(entries.some((e) => e.url === 'https://sikhai.vercel.app'));
    assert.ok(entries.some((e) => e.url === 'https://sikhai.vercel.app/pa'));
    for (const url of ['https://sikhai.vercel.app/shabad/1', 'https://sikhai.vercel.app/pa-latn/shabad/1430'])
        assert.ok(entries.some((e) => e.url === url), url);
    assert.ok(!entries.some((e) => e.url.endsWith('/shabad/1431')));
    for (const url of ['https://sikhai.vercel.app/learn', 'https://sikhai.vercel.app/pa/learn/script/tones', 'https://sikhai.vercel.app/pa-latn/learn/vocab/family'])
        assert.ok(entries.some((e) => e.url === url), url);
    for (const url of ['https://sikhai.vercel.app/privacy', 'https://sikhai.vercel.app/terms', 'https://sikhai.vercel.app/pa-latn/terms'])
        assert.ok(entries.some((e) => e.url === url), url);
});
