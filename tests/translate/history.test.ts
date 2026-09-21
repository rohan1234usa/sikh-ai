import { test } from 'node:test';
import assert from 'node:assert/strict';
import { TRANSLATE_RESULT_REV, type TranslationResult } from '@/lib/translate/config';
import {
    findCachedTranslation,
    normalizeInput,
    sameRequest,
    upsertHistory,
    type HistoryEntry,
} from '@/lib/translate/history';

function result(english: string, fallback?: 'cloud'): TranslationResult {
    return {
        detectedInput: 'punjabi-latin',
        gurmukhi: 'gurmukhi',
        roman: 'roman',
        english,
        words: [],
        notes: [],
        pronunciation: [],
        ...(fallback ? { fallback } : {}),
    };
}

function entry(input: string, over: Partial<HistoryEntry> = {}): HistoryEntry {
    return { input, sourceHint: 'auto', result: result(input), rev: TRANSLATE_RESULT_REV, ...over };
}

test('the same text typed differently is the same request', () => {
    assert.equal(normalizeInput('  Ki   haal\thai? '), 'ki haal hai?');
    // U+0A59 (ਖ਼ precomposed) and U+0A16 U+0A3C (ਖ + nukta) are the same letter.
    assert.equal(normalizeInput('ਖ਼'), normalizeInput('ਖ਼'));
    assert.ok(sameRequest({ input: 'Ki haal hai?', sourceHint: 'auto' }, { input: 'ki haal hai? ', sourceHint: 'auto' }));
});

test('a different hint is a different request', () => {
    assert.ok(!sameRequest({ input: 'Hor lavo ji', sourceHint: 'auto' }, { input: 'Hor lavo ji', sourceHint: 'punjabi-latin' }));
});

test('a saved full result is found again for the same text and hint', () => {
    const saved = entry('Ki haal hai?');
    assert.equal(findCachedTranslation([entry('other'), saved], 'ki haal hai?', 'auto'), saved);
    assert.equal(findCachedTranslation([saved], 'ki haal hai?', 'english'), undefined);
});

test('a Cloud fallback result is never reused, so asking again can get the full one', () => {
    const basic = entry('Ki haal hai?', { result: result('How are you?', 'cloud') });
    assert.equal(findCachedTranslation([basic], 'Ki haal hai?', 'auto'), undefined);
});

test('results saved under another prompt revision, or before revisions existed, are not reused', () => {
    assert.equal(findCachedTranslation([entry('Ki haal hai?', { rev: TRANSLATE_RESULT_REV - 1 })], 'Ki haal hai?', 'auto'), undefined);
    assert.equal(findCachedTranslation([entry('Ki haal hai?', { rev: undefined })], 'Ki haal hai?', 'auto'), undefined);
});

test('a new entry goes first and replaces its request wherever it was in the list', () => {
    const list = [entry('a'), entry('b'), entry('Ki haal hai?')];
    const fresh = entry('ki haal hai?');
    assert.deepEqual(upsertHistory(list, fresh, 30).map(e => e.input), ['ki haal hai?', 'a', 'b']);
});

test('a Cloud fallback never replaces a full result for the same request', () => {
    const list = [entry('a'), entry('Ki haal hai?')];
    const basic = entry('Ki haal hai?', { result: result('How are you?', 'cloud') });
    assert.equal(upsertHistory(list, basic, 30), list); // unchanged, so nothing is persisted
});

test('a full result does replace a Cloud fallback', () => {
    const list = [entry('Ki haal hai?', { result: result('How are you?', 'cloud') })];
    const full = entry('Ki haal hai?');
    assert.deepEqual(upsertHistory(list, full, 30), [full]);
});

test('the list is capped, dropping the oldest', () => {
    const list = [entry('b'), entry('c'), entry('d')];
    assert.deepEqual(upsertHistory(list, entry('a'), 3).map(e => e.input), ['a', 'b', 'c']);
});
