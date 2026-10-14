// The words of the Talk page (/translate/talk, #37), in Gurmukhi. Why they
// live here, apart from the dictionaries: ./en.ts.
//
// NOTE: AI-drafted translation, pending review by a fluent speaker, following
// the conventions of lib/i18n/dictionaries/pa.ts: formal-respectful register
// (ਤੁਸੀਂ); Western digits; Latin punctuation in UI strings, with । ending a
// sentence; brand names (Google, Gemini, Chrome, Safari, Firefox) and the
// Space key untranslated.

import type { TalkCopy } from './en';

const talk: TalkCopy = {
    title: 'ਬੋਲ ਕੇ ਅਨੁਵਾਦ',
    typeInstead: 'ਲਿਖ ਕੇ ਅਨੁਵਾਦ ਕਰੋ',
    newConversation: 'ਨਵੀਂ ਗੱਲਬਾਤ',
    intro: 'ਬਟਨ ਦਬਾ ਕੇ ਰੱਖੋ ਅਤੇ ਪੰਜਾਬੀ ਜਾਂ ਅੰਗਰੇਜ਼ੀ ਵਿੱਚ ਬੋਲੋ। ਬਟਨ ਛੱਡੋ, ਤਾਂ ਅਨੁਵਾਦ ਦਿਸੇਗਾ ਅਤੇ ਪੜ੍ਹ ਕੇ ਸੁਣਾਇਆ ਜਾਵੇਗਾ।',
    tip: 'ਇੱਕ ਵਾਰ ਵਿੱਚ 15 ਸਕਿੰਟਾਂ ਤੱਕ। ਜੇ “ਆਪਣੇ ਆਪ” ਗ਼ਲਤ ਭਾਸ਼ਾ ਸਮਝੇ, ਤਾਂ ਹੇਠਾਂ ਚੁਣੋ ਕਿ ਕੌਣ ਬੋਲ ਰਿਹਾ ਹੈ।',
    threadAria: 'ਗੱਲਬਾਤ',
    heard: '{lang} ਵਿੱਚ ਸੁਣਿਆ',
    translation: '{lang} ਵਿੱਚ ਅਨੁਵਾਦ',
    // The two languages: in the labels above, and on the chips under
    // the thread.
    langs: { pa: 'ਪੰਜਾਬੀ', en: 'ਅੰਗਰੇਜ਼ੀ' },
    cut: 'ਅਖ਼ੀਰ ਤੋਂ ਪਹਿਲਾਂ ਕੱਟਿਆ ਗਿਆ।',
    readAloud: 'ਪੜ੍ਹ ਕੇ ਸੁਣਾਓ',
    stopReading: 'ਸੁਣਾਉਣਾ ਬੰਦ ਕਰੋ',
    copyTranslation: 'ਅਨੁਵਾਦ ਕਾਪੀ ਕਰੋ',
    latest: 'ਸਭ ਤੋਂ ਨਵਾਂ',
    speakerAria: 'ਕੌਣ ਬੋਲ ਰਿਹਾ ਹੈ',
    speakerAuto: 'ਆਪਣੇ ਆਪ',
    speakSwitch: 'ਸੁਣਾਓ',
    speakSwitchHint: 'ਅਨੁਵਾਦ ਪੜ੍ਹ ਕੇ ਸੁਣਾਓ',
    hold: 'ਬੋਲਣ ਲਈ ਦਬਾ ਕੇ ਰੱਖੋ',
    starting: 'ਮਾਈਕ੍ਰੋਫ਼ੋਨ ਚਾਲੂ ਹੋ ਰਿਹਾ ਹੈ…',
    listening: 'ਸੁਣ ਰਿਹਾ ਹੈ… ਅਨੁਵਾਦ ਲਈ ਬਟਨ ਛੱਡੋ',
    paused: 'ਕਿਰਪਾ ਕਰਕੇ ਉਡੀਕ ਕਰੋ…',
    unavailable: 'ਇੱਥੇ ਰਿਕਾਰਡ ਨਹੀਂ ਹੋ ਸਕਦਾ',
    keyboardHint: 'ਕੀਬੋਰਡ ਨਾਲ: ਸ਼ੁਰੂ ਕਰਨ ਲਈ Space, ਰੋਕਣ ਲਈ ਦੁਬਾਰਾ Space।',
    translating: 'ਅਨੁਵਾਦ ਹੋ ਰਿਹਾ ਹੈ…',
    notes: {
        tooShort: 'ਬੋਲਦੇ ਵੇਲੇ ਬਟਨ ਦਬਾ ਕੇ ਰੱਖੋ।',
        tooLong: 'ਇਹ ਰਿਕਾਰਡਿੰਗ ਭੇਜਣ ਲਈ ਬਹੁਤ ਵੱਡੀ ਸੀ। ਕਿਰਪਾ ਕਰਕੇ ਇਸਨੂੰ ਛੋਟੀ ਰੱਖੋ।',
        micReady: 'ਮਾਈਕ੍ਰੋਫ਼ੋਨ ਤਿਆਰ ਹੈ। ਬਟਨ ਦਬਾ ਕੇ ਰੱਖੋ ਅਤੇ ਬੋਲੋ।',
        interrupted: 'ਪੰਨਾ ਲੁਕਣ ਕਰਕੇ ਰਿਕਾਰਡਿੰਗ ਰੁਕ ਗਈ।',
        nothingHeard: 'ਕੁਝ ਸੁਣਾਈ ਨਹੀਂ ਦਿੱਤਾ। ਬਟਨ ਦਬਾ ਕੇ ਰੱਖੋ ਅਤੇ ਸਾਫ਼ ਬੋਲੋ।',
        denied: 'ਮਾਈਕ੍ਰੋਫ਼ੋਨ ਬੰਦ ਹੈ। ਆਪਣੇ ਬ੍ਰਾਊਜ਼ਰ ਦੀਆਂ ਇਸ ਸਾਈਟ ਵਾਲੀਆਂ ਸੈਟਿੰਗਾਂ ਵਿੱਚ ਇਸਦੀ ਇਜਾਜ਼ਤ ਦਿਓ, ਫਿਰ ਦੁਬਾਰਾ ਕੋਸ਼ਿਸ਼ ਕਰੋ।',
        unavailable: 'ਕੋਈ ਮਾਈਕ੍ਰੋਫ਼ੋਨ ਨਹੀਂ ਮਿਲਿਆ।',
        busy: 'ਕੋਈ ਹੋਰ ਐਪ ਮਾਈਕ੍ਰੋਫ਼ੋਨ ਵਰਤ ਰਹੀ ਹੈ।',
        unsupported: 'ਇਹ ਬ੍ਰਾਊਜ਼ਰ ਆਵਾਜ਼ ਰਿਕਾਰਡ ਨਹੀਂ ਕਰ ਸਕਦਾ। Chrome, Safari ਜਾਂ Firefox ਵਰਤ ਕੇ ਦੇਖੋ।',
        insecure: 'ਰਿਕਾਰਡ ਕਰਨ ਲਈ ਸੁਰੱਖਿਅਤ (https) ਕਨੈਕਸ਼ਨ ਚਾਹੀਦਾ ਹੈ।',
        failed: 'ਰਿਕਾਰਡਿੰਗ ਨਹੀਂ ਹੋ ਸਕੀ। ਕਿਰਪਾ ਕਰਕੇ ਦੁਬਾਰਾ ਕੋਸ਼ਿਸ਼ ਕਰੋ।',
    },
    disclaimer: 'ਅਨੁਵਾਦ AI ਲਿਖਦਾ ਹੈ, ਅਤੇ ਇਹ ਗ਼ਲਤ ਹੋ ਸਕਦਾ ਹੈ। ਹਰ ਰਿਕਾਰਡਿੰਗ Google Gemini ਨੂੰ ਜਾਂਦੀ ਹੈ, ਅਤੇ ਪੰਜਾਬੀ Google ਪੜ੍ਹ ਕੇ ਸੁਣਾਉਂਦਾ ਹੈ; ਕੁਝ ਵੀ ਰੱਖਿਆ ਨਹੀਂ ਜਾਂਦਾ, ਅਤੇ ਪੰਨਾ ਦੁਬਾਰਾ ਖੋਲ੍ਹਣ ਨਾਲ ਸਭ ਮਿਟ ਜਾਂਦਾ ਹੈ।',
};

export default talk;
