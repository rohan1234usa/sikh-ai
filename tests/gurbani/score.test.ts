import { test } from 'node:test';
import assert from 'node:assert/strict';
import { tokens } from '@/lib/gurbani/gurmukhi';
import { compare, containedRun, isClose, lineKeys, looseKey, peel, toSearchLetters } from '@/lib/gurbani/score';

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
    const line = lineKeys('ੴ ਸਤਿ ਨਾਮੁ ਕਰਤਾ ਪੁਰਖੁ ॥').loose;
    assert.ok(containedRun(lineKeys('ਸਤਿਨਾਮੁ ਕਰਤਾ').loose, line), 'different spacing still matches');
    const verse = lineKeys('ਤੇਰਾ ਕੀਆ ਮੀਠਾ ਲਾਗੈ ॥').loose;
    assert.ok(!containedRun(lineKeys('ਤੇਰਾ ਕੀਆ ਮੀਠਾ ਲ').loose, verse), 'a truncated last word is not a match');
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
    const quote = lineKeys('ਤੇਰਾ ਕੀਆ ਮੀਠਾ ਲਾਗੈ ਹਰਿ ਨਾਮੁ ਪਦਾਰਥੁ ਨਾਨਕੁ ਮਾਂਗੈ');
    assert.deepEqual(peel(quote, lineKeys('ਤੇਰਾ ਕੀਆ ਮੀਠਾ ਲਾਗੈ ॥')), ['ਹਰਿ', 'ਨਾਮੁ', 'ਪਦਾਰਥੁ', 'ਨਾਨਕੁ', 'ਮਾਂਗੈ']);
    assert.deepEqual(peel(quote, lineKeys('ਹਰਿ ਨਾਮੁ ਪਦਾਰਥੁ ਨਾਨਕੁ ਮਾਂਗੈ ॥੨॥')), ['ਤੇਰਾ', 'ਕੀਆ', 'ਮੀਠਾ', 'ਲਾਗੈ']);
    assert.equal(peel(quote, lineKeys('ਮੀਠਾ ਲਾਗੈ ਹਰਿ')), null, 'a middle fragment is not a peel');
});
