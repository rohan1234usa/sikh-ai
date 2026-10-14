import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseLiveLines } from '@/lib/translate/live';
import {
    MAX_AUDIO_BASE64_CHARS,
    MAX_AUDIO_BYTES,
    MAX_SPEAK_CHARS,
    RECORDING_MIMES,
    SPEAKERS,
    audioMimeFor,
    base64Bytes,
    baseMime,
    capText,
    expectedInput,
    rolesOf,
    isBase64,
    isSpeakLang,
    isSpeaker,
    speakable,
    speechReady,
    voiceRoles,
} from '@/lib/translate/voice';

test('a media type loses its parameters and its case', () => {
    assert.equal(baseMime('audio/webm;codecs=opus'), 'audio/webm');
    assert.equal(baseMime(' Audio/MP4 '), 'audio/mp4');
    assert.equal(baseMime('audio/ogg; codecs=opus'), 'audio/ogg');
    assert.equal(baseMime(''), '');
});

test('every container a browser records in is audio Gemini hears; nothing else is', () => {
    for (const recorded of RECORDING_MIMES.filter(Boolean)) assert.ok(audioMimeFor(recorded), recorded);
    assert.equal(audioMimeFor('audio/webm;codecs=opus'), 'audio/webm');
    assert.equal(audioMimeFor('audio/OGG; codecs=opus'), 'audio/ogg');
    assert.equal(audioMimeFor('audio/mp4'), 'audio/mp4');
    assert.equal(audioMimeFor('audio/x-m4a'), 'audio/m4a');
    for (const refused of ['video/webm', 'text/plain', 'audio/', '', 'audio/webm2', 42, undefined, null]) {
        assert.equal(audioMimeFor(refused), null, String(refused));
    }
    // Names every object answers to are not on the list.
    for (const inherited of ['constructor', '__proto__', 'toString', 'hasOwnProperty', 'constructor;codecs=opus']) {
        assert.equal(audioMimeFor(inherited), null, inherited);
    }
});

test('base64 is checked and measured without decoding it', () => {
    assert.ok(isBase64('aGk='));
    assert.equal(base64Bytes('aGk='), 2);
    assert.equal(base64Bytes('AAAA'), 3);
    assert.equal(base64Bytes('AA=='), 1);
    for (const bad of ['', 'aGk', 'ab$=', 'aG=k', 'a-_b', 'aGk===', 'aGk= ']) assert.ok(!isBase64(bad), JSON.stringify(bad));
    // The longest clip a page may send is exactly what its base64 cap holds.
    assert.equal(MAX_AUDIO_BASE64_CHARS % 4, 0);
    assert.equal(base64Bytes(`${'A'.repeat(MAX_AUDIO_BASE64_CHARS - 4)}AA==`), MAX_AUDIO_BYTES);
    assert.ok(base64Bytes('A'.repeat(MAX_AUDIO_BASE64_CHARS)) > MAX_AUDIO_BYTES, 'unpadded, one byte over');
    assert.equal(base64Bytes(Buffer.from('a short clip').toString('base64')), 'a short clip'.length);
});

test('the chips and the speak languages are what they say', () => {
    for (const s of SPEAKERS) assert.ok(isSpeaker(s));
    assert.ok(!isSpeaker('hi') && !isSpeaker(undefined));
    assert.ok(isSpeakLang('pa') && isSpeakLang('en') && !isSpeakLang('hi'));
    assert.equal(expectedInput('pa'), 'punjabi-gurmukhi');
    assert.equal(expectedInput('en'), 'english');
    assert.equal(expectedInput('auto'), undefined);
});

test('what was heard and what is the translation, by the language spoken', () => {
    assert.deepEqual(voiceRoles('punjabi-gurmukhi'), { from: 'pa', to: 'en', heard: ['gurmukhi', 'roman'], said: ['english'] });
    assert.deepEqual(voiceRoles('punjabi-latin'), { from: 'pa', to: 'en', heard: ['gurmukhi', 'roman'], said: ['english'] });
    assert.deepEqual(voiceRoles('english'), { from: 'en', to: 'pa', heard: ['english'], said: ['gurmukhi', 'roman'] });
    assert.equal(voiceRoles('none'), null);
    assert.equal(voiceRoles(undefined), null);
    // A reply's roles: its INPUT line's, or the chip's until that comes.
    assert.equal(rolesOf({}, 'en')?.from, 'en');
    assert.equal(rolesOf({}, 'auto'), null, 'Auto waits for Gemini');
    assert.equal(rolesOf({ input: 'punjabi-gurmukhi' }, 'en')?.from, 'pa', 'what was heard wins over the chip');
    assert.equal(rolesOf({ input: 'none' }, 'pa'), null);
});

test('a line is read aloud only in a script its voice reads, and within the cap', () => {
    assert.ok(speakable('ਸਤਿ ਸ੍ਰੀ ਅਕਾਲ ਜੀ', 'pa'));
    assert.ok(!speakable('Sat Sri Akal ji', 'pa'), 'romanized Punjabi to a pa-IN voice is nonsense');
    assert.ok(speakable('Hello ji, how are you?', 'en'));
    assert.ok(!speakable('   ', 'en'));
    assert.ok(speakable('ਹ'.repeat(MAX_SPEAK_CHARS), 'pa'));
    assert.ok(!speakable('ਹ'.repeat(MAX_SPEAK_CHARS + 1), 'pa'));
});

test('a long line is cut at the cap, never through a surrogate pair', () => {
    assert.equal(capText('  hello  '), 'hello');
    assert.equal(capText('a'.repeat(MAX_SPEAK_CHARS + 50)).length, MAX_SPEAK_CHARS);
    const emoji = `${'a'.repeat(MAX_SPEAK_CHARS - 1)}😀`;
    assert.equal(capText(emoji), 'a'.repeat(MAX_SPEAK_CHARS - 1));
});

test('English speech: the Gurmukhi line is read once the ROMAN line has started', () => {
    const lines = (raw: string, done = false) => parseLiveLines(raw, done);
    assert.equal(speechReady(lines('INPUT: english\nGURMUKHI: ਤੁਸੀਂ ਕਿਵੇਂ'), 'auto', false), null, 'still coming');
    assert.deepEqual(
        speechReady(lines('INPUT: english\nGURMUKHI: ਤੁਸੀਂ ਕਿਵੇਂ ਹੋ?\nROMAN: Tusi'), 'auto', false),
        { text: 'ਤੁਸੀਂ ਕਿਵੇਂ ਹੋ?', lang: 'pa' },
    );
    assert.deepEqual(speechReady(lines('INPUT: english\nGURMUKHI: ਹਾਂਜੀ', true), 'auto', true), { text: 'ਹਾਂਜੀ', lang: 'pa' }, 'or once the reply ends');
    assert.equal(speechReady(lines('INPUT: english\nENGLISH: Yes', true), 'auto', true), null, 'no Gurmukhi came');
    // A chip names the language before the INPUT line has come.
    assert.deepEqual(speechReady({ gurmukhi: 'ਹਾਂਜੀ', roman: '' }, 'en', false), { text: 'ਹਾਂਜੀ', lang: 'pa' });
    assert.equal(speechReady({ gurmukhi: 'ਹਾਂਜੀ', roman: '' }, 'auto', false), null, 'Auto waits for Gemini');
});

test('Punjabi speech: the English line is read when the reply ends', () => {
    const raw = 'INPUT: punjabi-gurmukhi\nGURMUKHI: ਕੀ ਹਾਲ ਹੈ?\nROMAN: Ki haal hai?\nENGLISH: How are you?';
    assert.equal(speechReady(parseLiveLines(raw), 'auto', false), null, 'the last line may still be coming');
    assert.deepEqual(speechReady(parseLiveLines(raw, true), 'auto', true), { text: 'How are you?', lang: 'en' });
    assert.equal(speechReady(parseLiveLines('INPUT: none', true), 'auto', true), null, 'nothing heard, nothing read');
    assert.equal(speechReady(parseLiveLines('INPUT: punjabi-gurmukhi\nENGLISH:   ', true), 'pa', true), null);
});

test('the voice instruction keeps the translator’s rules, for every chip', async () => {
    const { composeTranslateInstruction, composeVoiceTranslateInstruction } = await import('@/lib/translate/prompts');
    const { LIVE_LABELS } = await import('@/lib/translate/live');
    const full = composeTranslateInstruction({ sourceHint: 'auto', detectedScript: 'latin' });
    const section = (s: string, name: string) => s.slice(s.indexOf(name)).split('\n\n')[0];
    for (const speaker of SPEAKERS) {
        const instruction = composeVoiceTranslateInstruction({ speaker });
        assert.equal(section(instruction, '## Fidelity'), section(full, '## Fidelity'), speaker);
        assert.equal(instruction.split('\n\n')[0], full.split('\n\n')[0].replace(', say so in a culture note,', ''), 'the same identity');
        for (const label of Object.values(LIVE_LABELS)) assert.match(instruction, new RegExp(`^${label}: `, 'm'));
        assert.match(instruction, /"INPUT: none"/);
        assert.doesNotMatch(instruction, /BEGIN TEXT|"detectedInput"|JSON/);
        // A chip names the language of any speech, and never orders a
        // transcript for a clip with none.
        const chip = section(instruction, '## Speaker');
        assert.doesNotMatch(chip, /(^|\. )Set the INPUT line/, speaker);
        if (speaker !== 'auto') assert.match(chip, /if the clip holds speech, .* still "INPUT: none"/, speaker);
    }
});
