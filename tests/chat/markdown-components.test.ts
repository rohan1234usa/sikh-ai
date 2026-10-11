import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { markdownComponents } from '@/app/components/chat/markdownComponents';
import { rehypeGurmukhiRuns } from '@/lib/chat/gurmukhiRuns';

const html = (text: string) =>
    renderToStaticMarkup(createElement(ReactMarkdown, { remarkPlugins: [remarkGfm], components: markdownComponents }, text));

test("an image in a reply shows as a link to it: nothing loads from another site, and nothing draws broken", () => {
    const out = html('At dawn: ![Harmandir Sahib](https://example.org/harmandir-sahib.jpg)');
    assert.ok(!out.includes('<img'), out);
    assert.match(out, /<a href="https:\/\/example\.org\/harmandir-sahib\.jpg" target="_blank" rel="noopener noreferrer" class="[^"]+">Harmandir Sahib<\/a>/);
});

test('an image with no alt text is labelled with its address, and one with an unsafe address is text only', () => {
    assert.match(html('![](https://example.org/a.png)'), /">https:\/\/example\.org\/a\.png<\/a>/);
    const unsafe = html('![a caption](javascript:alert(1))');
    assert.ok(!unsafe.includes('<img') && !unsafe.includes('<a') && !unsafe.includes('javascript:'), unsafe);
    assert.match(unsafe, /a caption/);
});

// Gurmukhi in a reply is marked as Punjabi stretch by stretch, and set in the
// Gurbani face where it's Gurbani: in quotes, or everywhere in a reply in
// English. One paragraph often holds the tukk, its transliteration and its
// translation, and only the tukk is Gurmukhi.
const render = (text: string, gurbani: 'quotes' | 'all') =>
    renderToStaticMarkup(createElement(ReactMarkdown, {
        remarkPlugins: [remarkGfm],
        rehypePlugins: [[rehypeGurmukhiRuns, { gurbani }]],
        components: markdownComponents,
    }, text));
const TIRO = /<span lang="pa" class="font-gurmukhi">/g;

test('Gurmukhi in a quote is Punjabi in the Gurbani face, and the English beside it is neither', () => {
    const out = render('> ਤੇਰਾ ਕੀਆ ਮੀਠਾ ਲਾਗੈ ॥\n> teraa keea meetthaa laagai\n> Your actions seem so sweet to me.', 'quotes');
    assert.match(out, /<span lang="pa" class="font-gurmukhi">ਤੇਰਾ ਕੀਆ ਮੀਠਾ ਲਾਗੈ ॥<\/span>/);
    assert.equal((out.match(/lang="pa"/g) ?? []).length, 1, out);
    assert.match(out, /Your actions seem so sweet to me\./);
});

test('in a Punjabi reply, Gurmukhi outside quotes is marked as Punjabi but keeps the interface face', () => {
    const out = render('ਸਤਿ ਸ੍ਰੀ ਅਕਾਲ ਜੀ।', 'quotes');
    assert.match(out, /<span lang="pa">ਸਤਿ ਸ੍ਰੀ ਅਕਾਲ ਜੀ।<\/span>/);
    assert.equal((out.match(TIRO) ?? []).length, 0, out);
});

test("in an English reply, Gurbani is set as Gurbani wherever it sits, even in a bold line of its own", () => {
    const out = render('**ਤੇਰਾ ਕੀਆ ਮੀਠਾ ਲਾਗੈ ॥** *Teraa keeaa meethaa laagai.* "Your actions seem so sweet to me."', 'all');
    assert.equal((out.match(TIRO) ?? []).length, 1, out);
    // Stretches are split around English, each wrapped on its own; code stays as written.
    assert.equal((render('> ਸਤਿ ਨਾਮੁ means True Name; ਕਰਤਾ ਪੁਰਖੁ the Creator', 'quotes').match(TIRO) ?? []).length, 2);
    assert.ok(!render('`ਸਤਿ`', 'all').includes('lang="pa"'));
});
