import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { TranslationResult } from '@/lib/translate/config';
import { PHRASES } from '@/lib/translate/phrasebook';
import { conventionIssues } from '../../scripts/translate-eval/score';

// Built from the curated entry, so no Gurmukhi is typed by hand here.
const phrase = PHRASES.find(p => p.id === 'waheguru-ji-ka-khalsa')!;
const [waheguru] = phrase.gurmukhi.split(' ');

function clean(): TranslationResult {
    return {
        detectedInput: 'punjabi-gurmukhi',
        gurmukhi: phrase.gurmukhi,
        roman: phrase.roman,
        english: phrase.english,
        words: [{ source: waheguru, gurmukhi: waheguru, roman: 'Waheguru', meaning: 'God' }],
        notes: [],
        pronunciation: [{ gurmukhi: waheguru, roman: 'Waheguru', tip: 'Stress the first syllable.' }],
    };
}

test('a result in house style has no issues', () => {
    assert.deepEqual(conventionIssues(clean()), []);
});

test('a proper noun loses its capital, even inside a word gloss', () => {
    const result = clean();
    result.words[0].roman = 'waheguru';
    assert.deepEqual(conventionIssues(result), ['words[0].roman: "waheguru" should be "Waheguru"']);
});

test('diacritics and apostrophes break the romanization rules', () => {
    const result = clean();
    result.roman = 'W\u0101heguru Ji Ka Khalsa';
    result.pronunciation[0].roman = "Wah'guru";
    const issues = conventionIssues(result);
    assert.ok(issues.some(i => i.startsWith('roman: non-ASCII \u0101')), issues.join('\n'));
    assert.ok(issues.some(i => i.startsWith('pronunciation[0].roman: apostrophe')), issues.join('\n'));
});

test('a community spelling variant is flagged', () => {
    const result = clean();
    result.roman = 'Vaheguru Ji Ka Khalsa';
    assert.deepEqual(conventionIssues(result), ['roman: "Vaheguru" should be "Waheguru"']);
});

test('a letter from another Indic script inside Gurmukhi is flagged; dandas are not', () => {
    const result = clean();
    result.gurmukhi = `${phrase.gurmukhi} \u0964`; // Devanagari danda, used in Gurmukhi text
    assert.deepEqual(conventionIssues(result), []);
    result.words[0].gurmukhi = `${waheguru}\u0915`; // Devanagari KA
    assert.deepEqual(conventionIssues(result), [`words[0].gurmukhi: non-Gurmukhi \u0915 in "${waheguru}\u0915"`]);
});
