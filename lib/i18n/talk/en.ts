// The words of the Talk page (/translate/talk, #37), in English. Like the
// Seva pages' (../seva), they live apart from the dictionaries, which every
// page sends to the browser: the page reads them (getTalkCopy() in
// ./index.ts) and hands them to its client island as a prop. The i18n audit
// checks them with the rest of the site's strings, under `talk.` The link
// to the page, its title and description, and the routes' error messages
// stay in the dictionaries, since other pages and the server use them.
// Relative type imports only: the audit runs this file under tsx.

import type { TalkNote } from '../../translate/talk';

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
    // Short, beside the privacy page's link, which says the rest: Google
    // keeps what Gemini is sent for up to 55 days, so not "nothing is kept".
    disclaimer: 'Translations are written by AI and can be wrong. Each recording goes to Google Gemini, and Google reads Punjabi aloud (and English, when your device can’t). This site keeps none of it: reloading the page clears it.',
};

export type TalkCopy = typeof talk;
export default talk;
