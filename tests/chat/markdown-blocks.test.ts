import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createElement, Fragment } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { splitMarkdownBlocks } from '@/lib/chat/markdownBlocks';

// A single render puts a newline between block elements, which draws nothing;
// separate renders don't. Only those newlines are ignored: one missing inside
// a paragraph would be a missing space, and still fails.
const BLOCK = 'p|ul|ol|li|blockquote|h[1-6]|pre|table|div|hr';
const betweenBlocks = new RegExp(`(</(?:${BLOCK})>|<hr/>)\\n+(?=<(?:${BLOCK})[\\s>/])`, 'g');
const normalize = (markup: string) => markup.replace(betweenBlocks, '$1');
const html = (text: string) =>
    normalize(renderToStaticMarkup(createElement(ReactMarkdown, { remarkPlugins: [remarkGfm] }, text)));
const htmlInBlocks = (text: string) =>
    normalize(renderToStaticMarkup(createElement(Fragment, null, ...splitMarkdownBlocks(text).map((b, i) =>
        createElement(ReactMarkdown, { key: i, remarkPlugins: [remarkGfm] }, b)))));

test('blocks join back into the text exactly', () => {
    for (const text of ['', 'one line', 'A\n\nB\n', 'A\n\n\n\nB', '\n\nA', 'A\n\n', '```\nx\n\ny\n```\n\nz\n']) {
        assert.equal(splitMarkdownBlocks(text).join(''), text);
    }
});

test('a cut goes at a blank line, before a finished line that starts a block', () => {
    assert.deepEqual(splitMarkdownBlocks('Para one.\n\nPara two.\n\nPara th'), ['Para one.\n\n', 'Para two.\n\nPara th'],
        'the last line is still arriving, so no cut before it yet');
    assert.deepEqual(splitMarkdownBlocks('## Title\n\nText\n\n> ਸਤਿ ਨਾਮੁ ॥\n'), ['## Title\n\n', 'Text\n\n', '> ਸਤਿ ਨਾਮੁ ॥\n']);
});

test('lists, indented continuations and fenced code stay in one block', () => {
    assert.deepEqual(splitMarkdownBlocks('1. a\n\n2. b\n\nNext\n'), ['1. a\n\n2. b\n\n', 'Next\n']);
    assert.deepEqual(splitMarkdownBlocks('- item\n\n  continued\n\nNew\n'), ['- item\n\n  continued\n\n', 'New\n']);
    assert.deepEqual(splitMarkdownBlocks('```\ncode\n\nmore\n```\n\nAfter\n'), ['```\ncode\n\nmore\n```\n\n', 'After\n']);
    assert.deepEqual(splitMarkdownBlocks('~~~~\n```\n\nstill code\n~~~~\n\nAfter\n'), ['~~~~\n```\n\nstill code\n~~~~\n\n', 'After\n'],
        'only a matching fence closes it');
    assert.deepEqual(splitMarkdownBlocks('```\nnever closed\n\nstill code\n'), ['```\nnever closed\n\nstill code\n']);
});

test("real replies render the same in blocks as whole, at every point while they stream", () => {
    const file = resolve(import.meta.dirname, '../gurbani/fixtures/replies.json');
    const replies = JSON.parse(readFileSync(file, 'utf8')) as { id: string; text: string }[];
    assert.ok(replies.length >= 10);
    let cuts = 0;
    for (const { id, text } of replies) {
        cuts += splitMarkdownBlocks(text).length - 1;
        for (let end = 200; end < text.length; end += 200) {
            const prefix = text.slice(0, end);
            assert.equal(htmlInBlocks(prefix), html(prefix), `${id}, first ${end} characters`);
        }
        assert.equal(htmlInBlocks(text), html(text), id);
    }
    assert.ok(cuts > replies.length, 'the replies were actually cut up');
});
