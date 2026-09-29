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
const { pathToRegexp } = createRequire(import.meta.url)('next/dist/compiled/path-to-regexp') as {
    pathToRegexp: (source: string) => RegExp;
};
const matches = (source: string, path: string) => pathToRegexp(source).test(path);

test('English URLs are served from /en; a language prefix never is', () => {
    const [home, pages] = languageRewrites();
    assert.equal(home.source, '/');
    assert.equal(home.destination, '/en');
    for (const path of ['/about', '/chat', '/chat/abc-123', '/seva/create', '/nope', '/paath'])
        assert.ok(matches(pages.source, path), path);
    for (const path of ['/pa', '/pa/about', '/pa-latn', '/pa-latn/chat/x', '/en', '/en/about'])
        assert.ok(!matches(pages.source, path), path);
});

test('a Punjabi cookie redirects pages, never files, the API or Next and Vercel paths', () => {
    const cookiePages = languageRedirects().filter((r) => r.has && r.source !== '/');
    assert.deepEqual(cookiePages.map((r) => r.has![0].value), ['pa', 'pa-latn']);
    const { source } = cookiePages[0];
    for (const path of ['/about', '/chat/abc-123', '/seva/create'])
        assert.ok(matches(source, path), path);
    // Vercel's analytics paths have no file extension to protect them, so only
    // the _vercel exclusion keeps a Punjabi reader's visits counting. (Vercel
    // also serves them at a per-build /<random>/ path, before these rules run.)
    for (const path of ['/og.jpg', '/robots.txt', '/sitemap.xml', '/favicon.ico', '/manifest.webmanifest',
        '/icon-192.png', '/icons/app.png', '/fonts/a/b.woff2', '/api/chat', '/api/shabad',
        '/_next/static/chunks/a.js', '/_vercel/speed-insights/script.js', '/_vercel/speed-insights/vitals',
        '/_vercel/insights/script.js', '/_vercel/insights/view', '/_vercel/insights/event',
        '/pa/about', '/pa-latn', '/en/about'])
        assert.ok(!matches(source, path), path);
    assert.ok(cookiePages.every((r) => !r.permanent), 'a choice can change, so never cached as permanent');
});

test('/en is never a public address', () => {
    const redirects = languageRedirects();
    assert.ok(redirects.some((r) => r.source === '/en' && r.destination === '/'));
    assert.ok(redirects.some((r) => r.source === '/en/:rest*' && r.destination === '/:rest*' && !r.has));
});

test('the sitemap lists every page and every Ang in every language, each with its twins', () => {
    const entries = sitemap();
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
