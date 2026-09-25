import { test } from 'node:test';
import assert from 'node:assert/strict';
import { getDictionary } from '@/lib/i18n';
import { openGraph, pageMetadata } from '@/lib/metadata';

test("a page's preview is its own title and URL, with every part a preview needs", () => {
    const t = getDictionary('en');
    const meta = pageMetadata('en', t, '/hukamnama', t.meta.hukamnamaTitle);
    assert.equal(meta.title, t.meta.hukamnamaTitle);
    assert.deepEqual(meta.alternates, { canonical: '/hukamnama' });
    const og = meta.openGraph as Record<string, unknown>;
    assert.equal(og.title, t.meta.titleTemplate.replace('%s', t.meta.hukamnamaTitle));
    assert.equal(og.url, '/hukamnama');
    // A page's openGraph replaces the root's rather than merging with it, so
    // the image, site name and locale have to come along every time.
    assert.deepEqual(og.images, [{ url: '/og.jpg', width: 1200, height: 630, alt: t.meta.ogImageAlt }]);
    assert.equal(og.siteName, 'SikhAI');
    assert.equal(og.locale, 'en_US');
});

test('the home page previews under the site title', () => {
    const t = getDictionary('pa');
    const meta = pageMetadata('pa', t, '/');
    assert.equal('title' in meta, false);
    assert.equal((meta.openGraph as Record<string, unknown>).title, t.meta.title);
    assert.equal((meta.openGraph as Record<string, unknown>).locale, 'pa_IN');
});

test("the root's fallback preview claims no URL", () => {
    const t = getDictionary('en');
    assert.equal('url' in openGraph('en', t, t.meta.title), false);
});
