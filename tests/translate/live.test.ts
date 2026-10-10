import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SOURCE_HINTS } from '@/lib/translate/config';
import {
    LIVE_CALLS_PER_MINUTE,
    LIVE_LABELS,
    LIVE_PAUSE_AFTER_REFUSAL_MS,
    MAX_LIVE_CHARS,
    liveEligible,
    liveFieldsFor,
    nextLiveCall,
    parseLiveLines,
    refusalPauseMs,
} from '@/lib/translate/live';
import { buildLiveTranslateRequest, composeLiveTranslateInstruction, composeTranslateInstruction } from '@/lib/translate/prompts';
import { ROMANIZATION_CAPITALS, ROMANIZATION_RULES } from '@/lib/translate/romanization';

const REPLY = 'INPUT: english\nGURMUKHI: ਤੁਸੀਂ ਕਿਵੇਂ ਹੋ?\nROMAN: Tusi kiven ho?\nENGLISH: How are you?';

test('a whole reply reads into its four fields', () => {
    assert.deepEqual(parseLiveLines(REPLY, true), {
        input: 'english',
        gurmukhi: 'ਤੁਸੀਂ ਕਿਵੇਂ ਹੋ?',
        roman: 'Tusi kiven ho?',
        english: 'How are you?',
    });
});

test('while it streams, each line shows as far as it has come, and a half-written label waits', () => {
    assert.deepEqual(parseLiveLines('INPUT: eng'), {}, 'not yet a value it knows');
    assert.deepEqual(parseLiveLines('INPUT: english\nGURMUKHI: ਤੁਸੀਂ ਕਿ'), { input: 'english', gurmukhi: 'ਤੁਸੀਂ ਕਿ' });
    // "RO" could be the start of ROMAN, so it isn't added to the Gurmukhi line.
    assert.deepEqual(parseLiveLines('INPUT: english\nGURMUKHI: ਤੁਸੀਂ ਕਿਵੇਂ ਹੋ?\nRO'), { input: 'english', gurmukhi: 'ਤੁਸੀਂ ਕਿਵੇਂ ਹੋ?' });
    assert.deepEqual(parseLiveLines('INPUT: english\nGURMUKHI: ਤੁਸੀਂ ਕਿਵੇਂ ਹੋ?\nROMAN'), { input: 'english', gurmukhi: 'ਤੁਸੀਂ ਕਿਵੇਂ ਹੋ?' });
    assert.deepEqual(parseLiveLines('INPUT: english\nGURMUKHI: ਤੁਸੀਂ ਕਿਵੇਂ ਹੋ?\nROMAN:'), { input: 'english', gurmukhi: 'ਤੁਸੀਂ ਕਿਵੇਂ ਹੋ?', roman: '' });
});

test('a missing line stays missing, so the page can mark it', () => {
    const lines = parseLiveLines('INPUT: punjabi-latin\nGURMUKHI: ਕੀ ਹਾਲ ਹੈ?\n', true);
    assert.equal(lines.english, undefined);
    assert.equal(lines.gurmukhi, 'ਕੀ ਹਾਲ ਹੈ?');
});

test('markdown and chatter around the labels are tolerated', () => {
    const lines = parseLiveLines('Sure, here it is:\n**Input:** "punjabi-gurmukhi"\n- **Gurmukhi:** ਸਤਿ ਸ੍ਰੀ ਅਕਾਲ\n**Roman:** Sat Sri Akal\n**English:** Hello (a Sikh greeting)', true);
    assert.deepEqual(lines, {
        input: 'punjabi-gurmukhi',
        gurmukhi: 'ਸਤਿ ਸ੍ਰੀ ਅਕਾਲ',
        roman: 'Sat Sri Akal',
        english: 'Hello (a Sikh greeting)',
    });
});

test('a line without a label carries on the one before it; an unknown INPUT is left out', () => {
    const lines = parseLiveLines('INPUT: hindi\nGURMUKHI: ਪਹਿਲੀ ਲਾਈਨ\nਦੂਜੀ ਲਾਈਨ\n\nROMAN: pehli line\nENGLISH: Note: first line', true);
    assert.equal(lines.input, undefined);
    assert.equal(lines.gurmukhi, 'ਪਹਿਲੀ ਲਾਈਨ ਦੂਜੀ ਲਾਈਨ');
    assert.equal(lines.english, 'Note: first line', 'a label later in a line is part of its text');
    // Once the stream is done, a short last line is text, not a label to come.
    assert.equal(parseLiveLines('INPUT: english\nENGLISH: in the\nin', true).english, 'in the in');
});

test('the lines shown are the translation, never the input echoed back', () => {
    assert.deepEqual(liveFieldsFor('english'), ['gurmukhi', 'roman']);
    assert.deepEqual(liveFieldsFor('punjabi-latin'), ['gurmukhi', 'english']);
    assert.deepEqual(liveFieldsFor('punjabi-gurmukhi'), ['roman', 'english']);
    assert.deepEqual(liveFieldsFor(undefined), ['gurmukhi', 'roman', 'english']);
});

test('live lines start at two words or eight characters, and stop past the cap', () => {
    assert.equal(liveEligible('  hello  '), 'short');
    assert.equal(liveEligible('ki haal'), 'ok');
    assert.equal(liveEligible('ਕੀ ਹਾਲ'), 'ok');
    assert.equal(liveEligible('wonderful'), 'ok');
    assert.equal(liveEligible('a'.repeat(MAX_LIVE_CHARS)), 'ok');
    assert.equal(liveEligible(`${'a'.repeat(MAX_LIVE_CHARS + 1)}`), 'long');
});

test('a page makes at most LIVE_CALLS_PER_MINUTE calls in any minute', () => {
    const t = 1_000_000;
    assert.deepEqual(nextLiveCall([], 0, t), { recent: [], at: t });
    // One call a second: the next is free once the first is a minute old.
    const calls = Array.from({ length: LIVE_CALLS_PER_MINUTE }, (_, i) => t + i * 1000);
    const now = calls.at(-1)! + 500;
    assert.deepEqual(nextLiveCall(calls, 0, now), { recent: calls, at: t + 60_000 });
    assert.equal(nextLiveCall(calls.slice(1), 0, now).at, now, 'one fewer: free now');
    // Calls more than a minute old are dropped, and no longer count.
    const later = nextLiveCall(calls, 0, t + 60_500);
    assert.deepEqual(later.recent, calls.slice(1));
    assert.equal(later.at, t + 60_500);
});

test('a refusal’s wait holds even when the minute has room', () => {
    assert.equal(nextLiveCall([], 5000, 1000).at, 5000);
    assert.equal(nextLiveCall([], 500, 1000).at, 1000, 'a wait that is over');
    assert.equal(refusalPauseMs('42'), 42_000);
    for (const missing of [null, '', 'soon', '0', '-5', 'Wed, 21 Oct 2026 07:28:00 GMT']) {
        assert.equal(refusalPauseMs(missing), LIVE_PAUSE_AFTER_REFUSAL_MS, String(missing));
    }
});

test('the live instruction keeps the translator’s rules and asks for the four labelled lines', () => {
    for (const sourceHint of SOURCE_HINTS) {
        for (const detectedScript of ['gurmukhi', 'latin'] as const) {
            const live = composeLiveTranslateInstruction({ sourceHint, detectedScript });
            const full = composeTranslateInstruction({ sourceHint, detectedScript });
            assert.ok(live.includes(`\n${ROMANIZATION_RULES}\n`));
            assert.ok(live.includes(`\n- ${ROMANIZATION_CAPITALS}\n`));
            for (const section of ['## Fidelity', '## Untrusted text']) {
                const of = (s: string) => s.slice(s.indexOf(section)).split('\n\n')[0];
                assert.equal(of(live), of(full), section);
            }
            for (const label of Object.values(LIVE_LABELS)) assert.match(live, new RegExp(`^${label}: `, 'm'));
            assert.doesNotMatch(live, /"detectedInput"|"words"|culture note|JSON/, 'nothing from the full result');
            assert.ok(live.length < full.length, 'a shorter opening');
        }
    }
});

test('the live request streams plain text quickly, with no schema', () => {
    const { config, contents } = buildLiveTranslateRequest('m', 'ki haal hai', { sourceHint: 'auto', detectedScript: 'latin' });
    assert.equal(config?.responseMimeType, undefined);
    assert.equal(config?.responseSchema, undefined);
    assert.equal(config?.maxOutputTokens, 1024);
    assert.equal(config?.thinkingConfig?.thinkingLevel, 'LOW');
    assert.match(String(contents), /^--- BEGIN TEXT [0-9a-f]{8} ---\nki haal hai\n--- END TEXT [0-9a-f]{8} ---$/);
});
