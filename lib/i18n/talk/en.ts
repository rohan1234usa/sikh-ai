// The words of the Talk page (/translate/talk, #37), in English. Like the
// Seva pages' (../seva), they live apart from the dictionaries, which every
// page sends to the browser: the page reads them (getTalkCopy() in
// ./index.ts) and hands them to its client island as a prop. The i18n audit
// checks them with the rest of the site's strings, under `talk.` The link
// to the page and its title and description stay in the dictionaries, which
// other pages and the server read; the voice and read-aloud routes' error
// messages are here, since only this page shows them.
// Relative type imports only: the audit runs this file under tsx.

import type { SpeakErrorCode, TalkNote, VoiceErrorCode } from '../../translate/talk';

const talk = {
    title: 'Talk',
    typeInstead: 'Type instead',
    newConversation: 'New conversation',
    intro: 'Hold the button and speak, in Punjabi or English. Let go, and the translation appears and is read aloud.',
    // {seconds}: how long a clip may be (MAX_CLIP_MS).
    tip: 'Up to {seconds} seconds at a time. If Auto hears the wrong language, choose who is speaking below.',
    threadAria: 'Conversation',
    heard: 'Heard in {lang}',
    translation: 'Translation in {lang}',
    // The two languages: in the labels above, and on the chips under
    // the thread.
    langs: { pa: 'Punjabi', en: 'English' },
    cut: 'Cut off before the end.',
    readAloud: 'Read aloud',
    stopReading: 'Stop reading',
    copyTranslation: 'Copy the translation',
    latest: 'Latest',
    speakerAria: 'Who is speaking',
    speakerAuto: 'Auto',
    speakSwitch: 'Speak',
    // The switch's name for a screen reader, which starts with the word
    // on it.
    speakSwitchHint: 'Speak translations aloud',
    hold: 'Hold to talk',
    starting: 'Starting the microphone…',
    listening: 'Listening… let go to translate',
    paused: 'Please wait…',
    unavailable: 'Recording isn’t available here',
    keyboardHint: 'With a keyboard: Space to start, Space again to stop.',
    translating: 'Translating…',
    notes: {
        tooShort: 'Hold the button down while you speak.',
        tooLong: 'That recording was too long to send. Please keep it shorter.',
        micReady: 'The microphone is ready. Hold the button and speak.',
        interrupted: 'Recording stopped when the page was hidden.',
        nothingHeard: 'Nothing was heard. Hold the button and speak clearly.',
        denied: 'The microphone is blocked. Allow it in your browser’s settings for this site, then try again.',
        unavailable: 'No microphone was found.',
        busy: 'Another app is using the microphone.',
        unsupported: 'This browser can’t record audio. Try Chrome, Safari or Firefox.',
        insecure: 'Recording needs a secure (https) connection.',
        failed: 'Recording didn’t work. Please try again.',
    } satisfies Record<TalkNote, string>,
    // The voice and read-aloud routes' refusals and failures, by code: on a
    // card, beside the button, or read out. Only this page shows them; the
    // routes send the same English (a test holds the allowance's equal).
    errors: {
        translate_voice_empty: 'Nothing was recorded. Please hold the button while you speak.',
        translate_voice_too_long: 'That recording is too long to send. Please keep it shorter.',
        translate_voice_bad_audio: "That recording couldn't be read. Please try again.",
        translate_voice_failed: 'Sorry, the voice translation failed. Please try again.',
        translate_voice_busy: 'The voice translator is busy right now. Please wait a minute and try again.',
        translate_voice_limit: "Your connection has reached today's limit for the voice translator. Please come back later.",
        translate_voice_blocked: "The voice translator couldn't translate that recording. Please try saying it another way.",
        speak_unavailable: "Reading aloud isn't available right now.",
        speak_failed: "Sorry, that couldn't be read aloud. Please try again.",
        speak_busy: 'Reading aloud is busy right now. Please wait a minute.',
        speak_limit: "Your connection has reached today's limit for reading aloud. Please come back later.",
    } satisfies Record<VoiceErrorCode | SpeakErrorCode, string>,
    // Short, beside the privacy page's link, which says the rest: Google
    // keeps what Gemini is sent for up to 55 days, so not "nothing is kept".
    disclaimer: 'Translations are written by AI and can be wrong. Each recording goes to Google Gemini, and Google reads Punjabi aloud (and English, when your device can’t). This site keeps none of it: reloading the page clears it.',
};

export type TalkCopy = typeof talk;
export default talk;
