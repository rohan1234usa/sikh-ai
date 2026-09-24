import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseTranslationResult } from '@/lib/translate/parse';

const word = (i: number) => ({ source: `w${i}`, gurmukhi: 'g', roman: `r${i}`, meaning: 'm' });
const note = (i: number) => ({ kind: 'idiom', title: `t${i}`, body: 'b' });
const tip = (i: number) => ({ gurmukhi: 'g', roman: `r${i}`, tip: 't' });

function answer(over: Record<string, unknown> = {}): string {
    return JSON.stringify({
        detectedInput: 'english',
        gurmukhi: 'gurmukhi',
        roman: 'roman',
        english: 'english',
        words: [word(0)],
        notes: [note(0)],
        pronunciation: [tip(0)],
        ...over,
    });
}

test('a valid answer parses, with its strings trimmed', () => {
    const result = parseTranslationResult(answer({ roman: '  Ki haal hai?  ' }), 'english');
    assert.equal(result?.roman, 'Ki haal hai?');
    assert.equal(result?.words.length, 1);
    assert.equal('fallback' in (result ?? {}), false);
});

test('an unusable answer is null: not JSON, not an object, or a rendition missing or blank', () => {
    assert.equal(parseTranslationResult('not json', 'english'), null);
    assert.equal(parseTranslationResult('null', 'english'), null);
    assert.equal(parseTranslationResult('"text"', 'english'), null);
    assert.equal(parseTranslationResult(answer({ english: undefined }), 'english'), null);
    assert.equal(parseTranslationResult(answer({ roman: '   ' }), 'english'), null);
});

test('an unknown detectedInput falls back to what the caller expected', () => {
    assert.equal(parseTranslationResult(answer({ detectedInput: 'klingon' }), 'punjabi-latin')?.detectedInput, 'punjabi-latin');
});

test('a malformed list entry is dropped, not fatal', () => {
    const result = parseTranslationResult(answer({ words: [word(0), { source: 'x' }, 'text', null, word(1)] }), 'english');
    assert.deepEqual(result?.words.map(w => w.source), ['w0', 'w1']);
});

test('an unknown note kind becomes "other"', () => {
    assert.equal(parseTranslationResult(answer({ notes: [{ kind: 'trivia', title: 't', body: 'b' }] }), 'english')?.notes[0].kind, 'other');
});

test('lists are capped: 40 words, 6 notes, 6 tips', () => {
    const many = (make: (i: number) => object, n: number) => Array.from({ length: n }, (_, i) => make(i));
    const result = parseTranslationResult(answer({ words: many(word, 50), notes: many(note, 10), pronunciation: many(tip, 10) }), 'english');
    assert.equal(result?.words.length, 40);
    assert.equal(result?.notes.length, 6);
    assert.equal(result?.pronunciation.length, 6);
});
