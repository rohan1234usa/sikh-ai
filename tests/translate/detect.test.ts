import { test } from 'node:test';
import assert from 'node:assert/strict';
import { detectScript, looksRomanizedPunjabi } from '@/lib/translate/detect';

// Written as escapes: ਸਤਿ ਸ੍ਰੀ ਅਕਾਲ, ਧੰਨਵਾਦ, ਮੇਰਾ, ਕਿੱਥੇ, ਹੈ.
const SAT_SRI_AKAL = '\u0A38\u0A24\u0A3F \u0A38\u0A4D\u0A30\u0A40 \u0A05\u0A15\u0A3E\u0A32';
const DHANVAAD = '\u0A27\u0A70\u0A28\u0A35\u0A3E\u0A26';

test('Gurmukhi input is detected by its share of letters', () => {
    assert.equal(detectScript(SAT_SRI_AKAL), 'gurmukhi');
    assert.equal(detectScript('Sat Sri Akal'), 'latin');
    assert.equal(detectScript(''), 'latin');
    assert.equal(detectScript('123 ?!'), 'latin');
});

test('one Gurmukhi word inside an English sentence stays Latin', () => {
    // 4 Gurmukhi letters of 16 (vowel signs are marks, not letters): 0.25 < 0.3.
    assert.equal(detectScript(`what does ${DHANVAAD} mean?`), 'latin');
});

test('mostly-Gurmukhi text with a Latin loanword is still Gurmukhi', () => {
    assert.equal(detectScript('\u0A2E\u0A47\u0A30\u0A3E phone \u0A15\u0A3F\u0A71\u0A25\u0A47 \u0A39\u0A48?'), 'gurmukhi');
});

test('romanized Punjabi is recognised by one function word, not by borrowed Sikh nouns', () => {
    assert.ok(looksRomanizedPunjabi('Main theek haan'));
    assert.ok(looksRomanizedPunjabi('Tusi kiven ho?'));
    assert.ok(looksRomanizedPunjabi('KI HAAL HAI, TUSI?'));
    assert.ok(!looksRomanizedPunjabi('I love the langar at our gurdwara'));
    assert.ok(!looksRomanizedPunjabi('Waheguru'));
});
