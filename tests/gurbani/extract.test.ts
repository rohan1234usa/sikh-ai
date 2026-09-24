import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { hasGurmukhiRun } from '@/lib/gurbani/citations';
import { extractQuotes, isPunjabiReply } from '@/lib/gurbani/extract';
import type { GurbaniLine } from '@/lib/gurbani/gurbaninow';
import { replies, reply } from './helpers';

// Real lines the extractor does treat as quotes (not headings, and not the
// greeting vocabulary it suppresses), so nothing here depends on scripture
// typed by hand. OTHER_TUK is a second, different line.
const QUOTABLE = Object.values(JSON.parse(
    readFileSync(resolve(import.meta.dirname, 'fixtures/gurbaninow.json'), 'utf8')) as Record<string, GurbaniLine[] | null>)
    .flatMap(l => l ?? [])
    .filter(l => !l.isHeader && l.gurmukhi.split(/\s+/).length >= 6 && extractQuotes(l.gurmukhi).length === 1)
    .map(l => l.gurmukhi);
const TUK = QUOTABLE[0];
const OTHER_TUK = QUOTABLE.find(l => extractQuotes(l)[0].quote !== extractQuotes(TUK)[0].quote)!;

const summary = (id: string) => extractQuotes(reply(id)).map(q => `${q.angHint ?? '-'} ${q.quote}`);

test('the 18 real answers yield exactly the quotes a reader would mark', () => {
    const counts = Object.fromEntries(
        replies.filter(r => !r.id.startsWith('synthetic:')).map(r => [r.id, extractQuotes(r.text).length]),
    );
    assert.deepEqual(counts, {
        'haumai-gurbani-first:36': 1, 'haumai-gurbani-first:38': 3, 'haumai-gurbani-first:lite': 1,
        'nanak-impersonation:36': 2, 'nanak-impersonation:38': 1, 'nanak-impersonation:lite': 0,
        'arjan-grief-gurbani-first:36': 1, 'arjan-grief-gurbani-first:38': 2, 'arjan-grief-gurbani-first:lite': 2,
        'gobind-sakhi:36': 0, 'gobind-sakhi:38': 0, 'gobind-sakhi:lite': 0,
        'simran-punjabi-gurmukhi:36': 1, 'simran-punjabi-gurmukhi:38': 1, 'simran-punjabi-gurmukhi:lite': 2,
        'langar-vichaar-bilingual:36': 0, 'langar-vichaar-bilingual:38': 0, 'langar-vichaar-bilingual:lite': 0,
    });
});

test('each quote is paired with the Ang cited after it', () => {
    assert.deepEqual(summary('haumai-gurbani-first:38'), [
        '466 ਹਉਮੈ ਦੀਰਘ ਰੋਗੁ ਹੈ ਦਾਰੂ ਭੀ ਇਸੁ ਮਾਹਿ ॥',
        '1 ਨਾਨਕ ਹੁਕਮੈ ਜੇ ਬੁਝੈ ਤ ਹਉਮੈ ਕਹੈ ਨ ਕੋਇ ॥',
        '560 ਹਉਮੈ ਨਾਵੈ ਨਾਲਿ ਵਿਰੋਧੁ ਹੈ ਦੁਇ ਨ ਵਸਹਿ ਇਕ ਠਾਇ ॥',
    ]);
    // Two lines of one shabad share the citation that follows them.
    assert.deepEqual(summary('nanak-impersonation:36'), ['3 ਕੀਤਾ ਪਸਾਊ ਏਕੋ ਕਵਾਉ ॥', '3 ਤਿਸ ਤੇ ਹੋਏ ਲਖ ਦਰੀਆਉ ॥']);
});

test('an Ang written in Gurmukhi numerals counts', () => {
    assert.deepEqual(summary('simran-punjabi-gurmukhi:38'), ['263 ਪ੍ਰਭ ਕਾ ਸਿਮਰਨੁ ਸਭ ਤੇ ਊਚਾ ॥']);
});

test('Punjabi replies: only ॥-closed lines count; greetings and headings never do', () => {
    assert.ok(isPunjabiReply(reply('simran-punjabi-gurmukhi:36')));
    assert.ok(!isPunjabiReply(reply('haumai-gurbani-first:38')));
    // This reply opens with the Fateh closed by ॥ — it must not be taken for a quote.
    assert.deepEqual(summary('simran-punjabi-gurmukhi:36'), ['- ਪ੍ਰਭ ਕਾ ਸਿਮਰਨੁ ਸਭ ਤੇ ਊਚਾ ॥']);
});

test('a word corrupted by another script stays whole, so it cannot verify by accident', () => {
    assert.deepEqual(summary('arjan-grief-gurbani-first:lite')[0], '394 ਤੇਰਾ ਕੀਆ ਮੀਠਾ ਲాగੈ ॥');
});

test('pairing does not cross into the next list item', () => {
    const text = [
        '1. First point:',
        '   **ਤੇਰਾ ਕੀਆ ਮੀਠਾ ਲਾਗੈ ॥**',
        '2. Second point, from Ang 466.',
    ].join('\n');
    assert.equal(extractQuotes(text)[0].angHint, undefined);
});

test('a lead-in citation binds to the quote right after it', () => {
    const text = 'On Ang 394, Guru Arjan Dev Ji says:\n> ਤੇਰਾ ਕੀਆ ਮੀਠਾ ਲਾਗੈ ॥';
    assert.equal(extractQuotes(text)[0].angHint, 394);
});

test('ranges and impossible Angs give no hint', () => {
    assert.equal(extractQuotes('ਤੇਰਾ ਕੀਆ ਮੀਠਾ ਲਾਗੈ ॥ (Ang 394-395)')[0].angHint, undefined);
    assert.equal(extractQuotes('ਤੇਰਾ ਕੀਆ ਮੀਠਾ ਲਾਗੈ ॥ (Ang 3940)')[0].angHint, undefined);
});

test('raag headings, short fragments and plain prose are not quotes', () => {
    assert.deepEqual(extractQuotes('ਆਸਾ ਮਹਲਾ ੫ ॥'), []);
    assert.deepEqual(extractQuotes('ਹਰਿ ਕਾ ਨਾਮੁ ॥'), [], 'too short to identify a line');
    const prose = extractQuotes(reply('synthetic:prose-phrase'));
    assert.equal(prose.length, 1);
    assert.equal(prose[0].hasDanda, false, 'unmarked Gurmukhi is only shown if it verifies');
});

test('a quote repeated later can supply the missing Ang', () => {
    const text = 'ਤੇਰਾ ਕੀਆ ਮੀਠਾ ਲਾਗੈ ॥\n\nAgain: ਤੇਰਾ ਕੀਆ ਮੀਠਾ ਲਾਗੈ ॥ (Ang 394)';
    const quotes = extractQuotes(text);
    assert.equal(quotes.length, 1);
    assert.equal(quotes[0].angHint, 394);
});

test('a lead-in binds across the blank line markdown puts before a blockquote', () => {
    // The shape models actually emit; before, the blank line started a new
    // block and the Ang was dropped, so wrong-Ang could never be reported.
    assert.equal(extractQuotes(`On Ang 394, Guru Arjan Dev Ji says:\n\n> ${TUK}`)[0].angHint, 394);
    assert.equal(extractQuotes(`> ${TUK}\n\n— Guru Arjan Dev Ji, Ang 394`)[0].angHint, 394);
});

test('a hint does not carry across a paragraph of its own', () => {
    const text = `Ang 394 holds that shabad.\n\nSomething else entirely.\n\n> ${TUK}`;
    assert.equal(extractQuotes(text)[0].angHint, undefined, 'a distant mention must not accuse the reply');
});

test('six quotes by default, the cards the chat can show; the eval can ask for every one', () => {
    // A whole-Ang explanation quotes dozens of lines.
    const text = [...new Set(QUOTABLE)].slice(0, 12).map(line => `> ${line}`).join('\n\n');
    const all = extractQuotes(text, { limit: Infinity });
    assert.ok(all.length > 6, `only ${all.length} distinct quotes`);
    assert.deepEqual(extractQuotes(text), all.slice(0, 6));
});

test("a Punjabi gloss that ends on the verse number is the reply's own words", () => {
    // Teeka style: each meaning repeats its tuk's verse number. In a 3.8 Flash
    // answer, two glosses each earned a "couldn't verify this line" card.
    const text = `**${TUK}**\n**ਅਰਥ:** ਇਸ ਲਈ ਸਾਧ ਸੰਗਤ ਵਿੱਚ ਜੁੜ ਕੇ ਕੇਵਲ ਪ੍ਰਭੂ ਦੇ ਨਾਮ ਦਾ ਸਿਮਰਨ ਕਰ ॥੧॥`;
    assert.deepEqual(extractQuotes(text).map(q => q.quote), extractQuotes(TUK).map(q => q.quote));
});

test('a lead-in stops at the end of its sentence', () => {
    // Since a lead-in may bind across the blank line before a blockquote, a
    // sentence that merely ends on an Ang must not hand it to the next quote.
    const english = `This shabad is on Ang 12, in Kirtan Sohila. Elsewhere, Guru Arjan Dev Ji writes:\n\n> ${TUK}`;
    assert.equal(extractQuotes(english)[0].angHint, undefined);
    const punjabi = `ਇਹ ਸ਼ਬਦ ਅੰਗ 12 ਉੱਤੇ ਹੈ। ਗੁਰੂ ਜੀ ਹੋਰ ਥਾਂ ਫ਼ੁਰਮਾਉਂਦੇ ਹਨ:\n\n> ${TUK}`;
    assert.equal(extractQuotes(punjabi)[0].angHint, undefined, 'a danda ends a Punjabi sentence');
    const oneSentence = `On Ang 394 (Raag Asa), Guru Arjan Dev Ji says:\n\n> ${TUK}`;
    assert.equal(extractQuotes(oneSentence)[0].angHint, 394);
});

test('an Ang cited inline belongs to the quote on its own line', () => {
    // The shape of a 3.8 Flash answer: a blockquote, then a sentence quoting
    // a second line with "(Ang 268)". Both used to take 268, so the first was
    // reported as found on a different Ang than the reply cited.
    const text = `> ${TUK}\n   The Guru also says: *"${OTHER_TUK}"* (Ang 268).`;
    const [first, second] = extractQuotes(text);
    assert.equal(first.angHint, undefined, 'the reply never cited an Ang for the blockquote');
    assert.equal(second.angHint, 268);
});

// A bilingual reply: mostly English, so Gurmukhi sentences are kept even
// without ॥ — the case where a single danda decides whether the reply is
// accused of misquoting.
const BILINGUAL = { punjabiReply: false };

test('a single danda is ordinary punctuation, not a claim about Gurbani', () => {
    assert.equal(extractQuotes(TUK.replace(/॥/g, '।'), BILINGUAL)[0].hasDanda, false);
    assert.equal(extractQuotes(TUK, BILINGUAL)[0].hasDanda, true, '॥ marks a verse');
});

test('the verify gate lets through everything the extractor would quote', () => {
    const commas = `${TUK.replace(/॥/g, '').trim().split(/\s+/).join(', ')} ॥`;
    assert.ok(extractQuotes(commas, BILINGUAL).length > 0);
    assert.ok(hasGurmukhiRun(commas), 'a comma between words must not switch the whole check off');
    assert.ok(!hasGurmukhiRun('Just English here.'));
});
