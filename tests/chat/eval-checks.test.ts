import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { ThinkingLevel } from '@google/genai';
import type { ChatContext } from '@/lib/chat/config';
import {
    blocks,
    endsWithOneQuestion,
    finishedNormally,
    firstPersonGuru,
    foreignIndic,
    gurmukhiShare,
    passageAng,
    passageLinesQuoted,
    quoteFirst,
} from '../../scripts/chat-eval/checks';
import { FIXTURES, SETS } from '../../scripts/chat-eval/fixtures';
import { costOf, parseVariant } from '../../scripts/chat-eval/run';

// Three Gurmukhi words, a greeting rather than scripture: ਸਤਿ ਸ੍ਰੀ ਅਕਾਲ.
const RUN = '\u0A38\u0A24\u0A3F \u0A38\u0A4D\u0A30\u0A40 \u0A05\u0A15\u0A3E\u0A32';
const EXPLANATION = 'This paragraph explains the teaching at some length. '.repeat(4);

test('quote first: a greeting may come before the quotation, an explanation may not', () => {
    const quote = `> ${RUN} \u0965\n> Sat Sri Akal\n> "Truth is the timeless one."`;
    assert.equal(quoteFirst(`Waheguru Ji Ka Khalsa, Waheguru Ji Ki Fateh.\n\n${quote}\n\n${EXPLANATION}`), null);
    assert.equal(quoteFirst(`${EXPLANATION}\n\n${quote}`), 'the explanation starts before the first quotation');
    assert.equal(quoteFirst(EXPLANATION), 'no Gurbani quotation in Gurmukhi');
});

test('vichaar: exactly one question, at the very end', () => {
    assert.equal(endsWithOneQuestion('Langar is equality in practice.\n\nWhat might you share today?'), null);
    assert.equal(endsWithOneQuestion('*What might you share today?*'), null);
    assert.equal(endsWithOneQuestion('Why? Because.\n\nWhat will you do? And when?'), 'the closing paragraph asks 2 questions');
    assert.equal(endsWithOneQuestion('What might you share today?\n\nWaheguru Ji Ka Khalsa.'), 'does not end with a question');
});

test('speaking as the Guru is caught; speaking about the Guru is not', () => {
    assert.equal(firstPersonGuru('Guru Nanak Dev Ji teaches that the Divine is within all.'), null);
    assert.match(firstPersonGuru('I, Guru Nanak, am with you.') ?? '', /speaks as the Guru/);
    assert.match(firstPersonGuru('Rise, my dear child, and walk on.') ?? '', /my dear child/);
});

test('script checks count Gurmukhi letters and catch neighbouring-script letters, but not dandas', () => {
    assert.equal(gurmukhiShare(RUN), 1);
    assert.equal(gurmukhiShare('Sat Sri Akal'), 0);
    assert.deepEqual(foreignIndic(`${RUN} \u0964 \u0965`), []);
    assert.deepEqual(foreignIndic('\u0A38\u0A24\u09BF'), ['\u09BF']); // a Bengali vowel sign on a Gurmukhi word
});

test('a passage line counts as quoted when its first four words appear in the reply', () => {
    const passages = JSON.parse(readFileSync(resolve(import.meta.dirname, '../../scripts/chat-eval/passages.json'), 'utf8')) as { shabad: ChatContext };
    const [first, second] = passages.shabad.text.split('\n\n').map(item => item.split('\n')[0]);
    assert.ok(passageLinesQuoted(`The Shabad opens:\n\n> ${first}\n\nThen: **${second}**`, passages.shabad) >= 2);
    assert.equal(passageLinesQuoted('An answer that quotes nothing.', passages.shabad), 0);
});

test('a passage names its Ang in its title; list items are blocks of their own', () => {
    const context = (title: string): ChatContext => ({ type: 'hukamnama', title, text: '', capturedAt: 0 });
    assert.equal(passageAng(context("Today's Hukamnama — Ang 584")), 584);
    assert.equal(passageAng(context("Today's Hukamnama")), null);
    assert.deepEqual(blocks('## Before you go\n* **Shoes:** off at the door.\n* Cover your head.\n\nEnjoy langar.'),
        ['Before you go', 'Shoes: off at the door.', 'Cover your head.', 'Enjoy langar.']);
});

test('only a normal finish counts as finished', () => {
    assert.equal(finishedNormally({ text: '', context: null, finishReason: 'STOP' }), null);
    assert.equal(finishedNormally({ text: '', context: null }), null);
    assert.equal(
        finishedNormally({ text: '', context: null, finishReason: 'MAX_TOKENS', outputTokens: 4096 }),
        'stopped early: MAX_TOKENS after 4096 tokens',
    );
});

test('a variant is a model, optionally at a thinking level; an answer is priced from its tokens', () => {
    assert.deepEqual(parseVariant('gemini-3.8-flash'), { label: 'gemini-3.8-flash', model: 'gemini-3.8-flash' });
    assert.equal(parseVariant('gemini-3.8-flash@Medium').thinkingLevel, ThinkingLevel.MEDIUM);
    assert.throws(() => parseVariant('gemini-3.8-flash@lots'), /unknown thinking level/);
    assert.throws(() => parseVariant('a@low@high'), /expected model or model@level/);
    // 1M prompt tokens at $0.75, plus 200K output and thinking tokens at $3.75/M.
    assert.equal(costOf({ model: 'gemini-3.8-flash', usage: { prompt: 1_000_000, output: 100_000, thoughts: 100_000 } }), 1.5);
    assert.equal(costOf({ model: 'gemini-unpriced', usage: { prompt: 1 } }), null);
});

test('the fixtures are well formed: unique ids, a reason, checks, and sets drawn from them', () => {
    const ids = FIXTURES.map(f => f.id);
    assert.equal(new Set(ids).size, ids.length);
    for (const fixture of FIXTURES) {
        assert.ok(fixture.why.length > 20, `${fixture.id} says why it is here`);
        assert.ok(fixture.checks.length > 0, `${fixture.id} has a check`);
    }
    assert.ok(SETS.core().length >= 5);
    assert.ok(SETS['gurbani-first']().every(f => f.modeId === 'gurbani-first'));
});
