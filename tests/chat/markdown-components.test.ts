import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { markdownComponents } from '@/app/components/chat/markdownComponents';

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
