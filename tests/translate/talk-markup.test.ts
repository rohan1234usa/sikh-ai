import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createElement, type ComponentProps } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import TalkExchange from '@/app/components/translate/TalkExchange';
import { LanguageProvider } from '@/app/context/LanguageContext';
import { getDictionary } from '@/lib/i18n';
import type { Lang } from '@/lib/i18n/config';
import { getTalkCopy } from '@/lib/i18n/talk';
import type { Exchange } from '@/lib/translate/talk';

// One exchange's card as the server would draw it, in a language: the page's
// words come from lib/i18n/talk, as the page hands them over; the shared
// ones (errors, "didn't come through") from the dictionary.
const card = (exchange: Exchange, lang: Lang = 'en', extra: { playing?: boolean; trouble?: 'speak_failed' | null } = {}) =>
    renderToStaticMarkup(createElement(
        LanguageProvider,
        // The child goes as an argument, which the props' type doesn't know.
        { lang } as ComponentProps<typeof LanguageProvider>,
        createElement(TalkExchange, { copy: getTalkCopy(lang), exchange, playing: false, trouble: null, onSpeak: () => {}, onStop: () => {}, ...extra }),
    ));

const PUNJABI: Exchange = {
    id: 'a',
    speaker: 'auto',
    status: 'done',
    lines: { input: 'punjabi-gurmukhi', gurmukhi: 'ਕੀ ਹਾਲ ਹੈ?', roman: 'Ki haal hai?', english: 'How are you?' },
};
const ENGLISH: Exchange = {
    id: 'b',
    speaker: 'en',
    status: 'done',
    lines: { input: 'english', gurmukhi: 'ਤੁਸੀਂ ਕਿਵੇਂ ਹੋ?', roman: 'Tusi kiven ho?', english: 'How are you?' },
};

test('Punjabi heard: its two scripts under "Heard", the English under "Translation", each line in its language', () => {
    const html = card(PUNJABI);
    assert.match(html, /^<li /);
    assert.ok(html.indexOf('Heard in Punjabi') < html.indexOf('ਕੀ ਹਾਲ ਹੈ?'));
    assert.ok(html.indexOf('ਕੀ ਹਾਲ ਹੈ?') < html.indexOf('Translation in English'));
    assert.ok(html.indexOf('Translation in English') < html.indexOf('How are you?'));
    assert.match(html, /<p lang="pa" class="font-gurmukhi[^"]*">ਕੀ ਹਾਲ ਹੈ\?<\/p>/);
    assert.match(html, /<p lang="pa-Latn" class="[^"]*">Ki haal hai\?<\/p>/);
    assert.match(html, /<p lang="en" class="[^"]*text-2xl[^"]*">How are you\?<\/p>/, 'the translation is the large line');
    assert.match(html, /Read aloud/);
});

test('English heard: the Punjabi translation is the large Gurmukhi line, never bold', () => {
    const html = card(ENGLISH);
    assert.ok(html.indexOf('Heard in English') < html.indexOf('Translation in Punjabi'));
    const gurmukhi = /<p lang="pa" class="([^"]*)">ਤੁਸੀਂ ਕਿਵੇਂ ਹੋ\?<\/p>/.exec(html);
    assert.ok(gurmukhi, html);
    assert.match(gurmukhi[1], /font-gurmukhi/);
    assert.match(gurmukhi[1], /text-2xl/);
    assert.doesNotMatch(gurmukhi[1], /font-(bold|semibold)/);
});

test('while it streams: what came so far, the dots for what hasn’t, and nothing to replay yet', () => {
    const html = card({ ...ENGLISH, status: 'streaming', lines: { input: 'english', english: 'How are you?' } });
    assert.match(html, /How are you\?/);
    assert.match(html, /role="img" aria-label="Translating…"/);
    assert.doesNotMatch(html, /Read aloud/);
    assert.doesNotMatch(html, /didn’t come through/, 'a line still coming is not missing');
});

test('a line that never came is marked; a reply cut short says so and offers no replay', () => {
    const missing = card({ ...PUNJABI, lines: { input: 'punjabi-gurmukhi', gurmukhi: 'ਕੀ ਹਾਲ ਹੈ?', english: 'How are you?' } });
    assert.match(missing, /didn’t come through/);
    const cut = card({ ...ENGLISH, status: 'cut', lines: { input: 'english', english: 'How are', gurmukhi: 'ਤੁਸੀਂ' } });
    assert.match(cut, /Cut off before the end\./);
    assert.doesNotMatch(cut, /Read aloud/);
});

test('a failed exchange says why, in the page’s language', () => {
    const failed: Exchange = { id: 'c', speaker: 'auto', status: 'failed', lines: {}, error: 'translate_voice_busy' };
    assert.match(card(failed), new RegExp(getDictionary('en').errors.translate_voice_busy.replace(/[.?]/g, '\\$&')));
    assert.ok(card(failed, 'pa').includes(getDictionary('pa').errors.translate_voice_busy));
});

test('while it is read, the button stops it; a read that failed says so beside it', () => {
    assert.match(card(PUNJABI, 'en', { playing: true }), /Stop reading/);
    // As markup writes it: its apostrophe escaped.
    const said = getDictionary('en').errors.speak_failed.replace(/'/g, '&#x27;');
    assert.ok(card(PUNJABI, 'en', { trouble: 'speak_failed' }).includes(said));
});

test('the labels follow the page’s language', () => {
    const html = card(PUNJABI, 'pa-latn');
    assert.match(html, /Punjabi vich sunia/);
    assert.match(html, /Angrezi vich anuvaad/);
});
