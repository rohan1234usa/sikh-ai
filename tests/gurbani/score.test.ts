import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { GurbaniLine } from '@/lib/gurbani/gurbaninow';
import { tokens } from '@/lib/gurbani/gurmukhi';
import { compare, containedRun, isClose, lineKeys, looseKey, peel, toSearchLetters } from '@/lib/gurbani/score';

// Real lines as GurbaniNow records them: the ground truth a comparison is
// measured against is never typed here by hand.
const PAGES: Record<string, GurbaniLine[] | null> = JSON.parse(
    readFileSync(resolve(import.meta.dirname, 'fixtures/gurbaninow.json'), 'utf8'));
const RECORDED = Object.values(PAGES).flatMap(l => l ?? []);
const wordsOf = (line: string) => lineKeys(line).raw;

test('the lifted tokenizer kept its invisible characters', () => {
    // A zero-width space marks a word break in larivaar text; losing it in the
    // copy would fuse these into one token.
    assert.equal(tokens('ਲਾਲ​ਜਵੇਹਰ').length, 2);
    assert.deepEqual(tokens('ਹਰਿ ਨਾਮੁ ਪਦਾਰਥੁ ॥੨॥੪੨॥'), ['ਹਰਿ', 'ਨਾਮੁ', 'ਪਦਾਰਥੁ']);
});

test('loose keys forgive vowel slips but not different words', () => {
    assert.equal(looseKey('ਪਸਾਊ'), looseKey('ਪਸਾਉ'));
    assert.equal(looseKey('ਖ਼ਾਲਸਾ'), looseKey('ਖਾਲਸਾ'));
    assert.equal(looseKey('ਟਰੋਂ'), looseKey('ਟਰੋ'));
    assert.notEqual(looseKey('ਤੈਡਾ'), looseKey('ਤੇਰਾ'));
});

test('search letters use the carriers GurbaniNow indexes vowels under', () => {
    assert.equal(toSearchLetters('ਹਦਰਹਦਭਇਮ'), 'ਹਦਰਹਦਭੲਮ');
    assert.equal(toSearchLetters('ਆਐਔਈਏਊਓ'), 'ਅਅਅੲੲੳੳ');
});

test('containment is on whole words, spacing aside, and rejects a cut-off word', () => {
    const source = RECORDED.find(l => wordsOf(l.gurmukhi).length >= 5)!;
    const words = wordsOf(source.gurmukhi);
    const line = lineKeys(source.gurmukhi).loose;
    assert.ok(containedRun(lineKeys(words.slice(1, 3).join('')).loose, line), 'different spacing still matches');
    const cutOff = `${words.slice(1, 3).join(' ')} ${[...words[3]][0]}`;
    assert.ok(!containedRun(lineKeys(cutOff).loose, line), 'a truncated last word is not a match');
});

test('a subjoined ha matches whether written as GurbaniNow does or as standard Unicode', () => {
    // GurbaniNow spells it with the udaat sign (U+0A51); a model writes virama
    // + ha. Found in the chat eval: 3.7 Flash quoted a line correctly and it
    // was reported as altered. The quote is made from a recorded line, so no
    // scripture is typed here.
    const lines = RECORDED.filter(l => l.gurmukhi.includes('\u0A51'));
    assert.ok(lines.length > 0, 'the recordings include a line with U+0A51');
    for (const line of lines) {
        const quote = line.gurmukhi.replaceAll('\u0A51', '\u0A4D\u0A39');
        const c = compare(lineKeys(quote), lineKeys(line.gurmukhi));
        assert.ok(c.contained && c.exact, line.gurmukhi);
    }
});

test('the fold is for comparing, never for quoting back at the reader', () => {
    // peel() hands these words back as the next quote, and a card prints them
    // under "In the reply" — so they must stay spelled as the reply wrote them.
    const line = RECORDED.find(l => l.gurmukhi.includes('\u0A51'))!.gurmukhi;
    const asModelsWriteIt = line.replaceAll('\u0A51', '\u0A4D\u0A39');
    const keys = lineKeys(asModelsWriteIt);
    assert.ok(keys.raw.join(' ').includes('\u0A4D\u0A39'), 'raw keeps virama + ha');
    assert.ok(!keys.raw.join(' ').includes('\u0A51'));
    assert.ok(keys.folded.join(' ').includes('\u0A51'), 'folded carries GurbaniNow\'s spelling');
});

test('the altered line from the model comparison is close, not verified', () => {
    const c = compare(lineKeys('ਤੈਡਾ ਕੀਤਾ ਮੀਠਾ ਲਾਗੈ ॥'), lineKeys('ਤੇਰਾ ਕੀਆ ਮੀਠਾ ਲਾਗੈ ॥'));
    assert.equal(c.contained, false);
    assert.ok(isClose(c), 'exactly on the 0.5 boundary, which must count');
});

test('sharing words with a much longer line is not "close"', () => {
    // The shape of the invented-line case: half the quote matched, in order,
    // but inside a line more than twice its length (dice ≈ 0.3).
    const base = { contained: false, exact: false, lettersQ: 16, orderRun: 5, firstQ: 5 };
    assert.equal(isClose({ ...base, matched: 8, lettersV: 38 }), false);
    assert.equal(isClose({ ...base, matched: 8, lettersV: 16 }), true, 'the same overlap with a same-length line is close');
});

test('two verse lines run together peel apart', () => {
    // Two consecutive lines of one recorded page, quoted with no ॥ between.
    const page = Object.values(PAGES).find(p => (p ?? []).filter(l => !l.isHeader && wordsOf(l.gurmukhi).length >= 4).length >= 2)!;
    const [first, second] = page!.filter(l => !l.isHeader && wordsOf(l.gurmukhi).length >= 4);
    const quote = lineKeys(`${first.gurmukhi} ${second.gurmukhi}`.replace(/[॥।]/g, ' '));
    assert.deepEqual(peel(quote, lineKeys(first.gurmukhi)), wordsOf(second.gurmukhi));
    assert.deepEqual(peel(quote, lineKeys(second.gurmukhi)), wordsOf(first.gurmukhi));
    const middle = [...wordsOf(first.gurmukhi).slice(-2), ...wordsOf(second.gurmukhi).slice(0, 2)].join(' ');
    assert.equal(peel(quote, lineKeys(middle)), null, 'a middle fragment is not a peel');
});
