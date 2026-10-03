import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import ShabadVerse from '@/app/components/shabad/ShabadVerse';
import { parseShabadPayload } from '@/lib/gurbani/gurbaninow';
import { localName, type Shabad } from '@/lib/gurbani/shabad';
import {
    firstVerse, jsonLdText, shabadAngList, shabadAngs, shabadDescription, shabadStructuredData, shabadTitle,
} from '@/lib/gurbani/shabadPage';
import { getDictionary } from '@/lib/i18n';
import { LANGS } from '@/lib/i18n/config';

// Recorded shabads (npm run fixtures:gurbani -- --only shabad): 823 runs from
// Ang 10 onto 11, 4Z1 stays on Ang 394.
const RECORDED: Record<string, unknown> = JSON.parse(readFileSync(resolve(import.meta.dirname, 'fixtures/shabads.json'), 'utf8'));
const shabad = (id: string): Shabad => {
    const parsed = parseShabadPayload(RECORDED[`shabad:${id}`]);
    assert.ok(parsed);
    return parsed;
};

test('a shabad is known by its first verse, past the headings and without the closing marks', () => {
    for (const id of ['823', 'DMP', '4Z1', 'Q5K']) {
        const s = shabad(id);
        const verse = s.lines.find(l => l.kind === 'verse')!;
        const name = firstVerse(s);
        assert.ok(verse.gurmukhi.startsWith(name), id);
        assert.doesNotMatch(name, /[\s।॥੦-੯]$/u, `${id}: no danda or verse number at the end`);
        assert.notEqual(s.lines[0].kind, 'verse', `${id} opens with a heading or the mangal, which the name skips`);
    }
});

test("a page's title and description name its first verse and Ang, in each language", () => {
    for (const lang of LANGS) {
        const t = getDictionary(lang);
        const s = shabad('823');
        const title = shabadTitle(t, s);
        assert.ok(title.includes('10'), `${lang}: ${title}`);
        assert.ok(title.startsWith(firstVerse(s).slice(0, 20)), `${lang}: ${title}`);
        assert.ok(title.length <= 80, `${lang}: titles stay short`);
        const description = shabadDescription(t, s);
        assert.ok(description.startsWith(firstVerse(s).slice(0, 20)) && description.includes('10'), `${lang}: ${description}`);
        assert.doesNotMatch(title + description, /\{\w+\}/, `${lang}: every placeholder filled`);
    }
});

test('a shabad on two Angs says so, and links to both', () => {
    const t = getDictionary('en');
    assert.equal(shabadAngs(t, shabad('823')), 'Angs 10–11');
    assert.deepEqual(shabadAngList(shabad('823')), [10, 11]);
    assert.equal(shabadAngs(t, shabad('4Z1')), 'Ang 394');
    assert.deepEqual(shabadAngList(shabad('4Z1')), [394]);
    assert.equal(shabadAngs(getDictionary('pa'), shabad('Q5K')), 'ਅੰਗ 394–395');
});

test("writers and raags are named in Gurmukhi only on the Gurmukhi site", () => {
    const s = shabad('823');
    assert.equal(localName('pa', s.writer, s.writerGurmukhi), s.writerGurmukhi);
    assert.equal(localName('en', s.writer, s.writerGurmukhi), s.writer);
    assert.equal(localName('pa-latn', s.writer, s.writerGurmukhi), s.writer);
    assert.equal(localName('pa', 'Only English', ''), 'Only English', 'whichever name there is');
    assert.equal(localName('en', '', 'ਸਿਰਫ਼'), 'ਸਿਰਫ਼');
});

test("the structured data places the shabad under its Ang and Shabad Search, in the page's language", () => {
    const t = getDictionary('pa-latn');
    const s = shabad('823');
    const data = shabadStructuredData('pa-latn', t, s, shabadDescription(t, s));
    assert.equal(data.url, 'https://sikhai.vercel.app/pa-latn/shabad/s/823');
    assert.equal(data.inLanguage, 'pa-Latn');
    assert.equal(data.about.inLanguage, 'pa');
    assert.deepEqual(data.about.author, { '@type': 'Person', name: s.writer });
    assert.deepEqual(data.breadcrumb.itemListElement.map(c => c.item), [
        'https://sikhai.vercel.app/pa-latn/shabad',
        'https://sikhai.vercel.app/pa-latn/shabad/10',
        'https://sikhai.vercel.app/pa-latn/shabad/s/823',
    ]);
    assert.deepEqual(data.breadcrumb.itemListElement.map(c => c.position), [1, 2, 3]);
});

test('structured data can never close its script tag', () => {
    const text = jsonLdText({ name: '</script><script>alert(1)</script>' });
    assert.ok(!text.includes('<'), text);
    assert.deepEqual(JSON.parse(text), { name: '</script><script>alert(1)</script>' });
});

test('each line of a shabad can be pointed at, and says which script it is in', () => {
    for (const line of shabad('823').lines) {
        const html = renderToStaticMarkup(createElement(ShabadVerse, { line }));
        assert.match(html, new RegExp(`^<div id="line-${line.id}" tabindex="-1"`), line.id);
        assert.ok(html.includes(`<p lang="pa"`) && html.includes(line.gurmukhi.replace(/&/g, '&amp;')), line.id);
        assert.equal(html.includes('lang="pa-Latn"'), Boolean(line.transliteration), line.id);
        assert.equal(html.includes('lang="en"'), Boolean(line.translation), line.id);
        assert.match(html, /target:ring-2/, 'marked on a full page load');
        assert.match(html, /data-highlighted:ring-2/, 'and after a move within the site');
        assert.match(html, /scroll-mt-20/, 'clear of the sticky navbar');
    }
    const [heading, verse] = [shabad('823').lines.find(l => l.kind === 'header')!, shabad('823').lines.find(l => l.kind === 'verse')!];
    assert.match(renderToStaticMarkup(createElement(ShabadVerse, { line: verse })), /text-2xl/, 'verses are set large');
    assert.doesNotMatch(renderToStaticMarkup(createElement(ShabadVerse, { line: heading })), /text-2xl/, 'headings smaller');
});
