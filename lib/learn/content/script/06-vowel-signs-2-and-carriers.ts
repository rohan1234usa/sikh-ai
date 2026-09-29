// Script track, lesson 6: the other four vowel signs (lavan, dulavan, hora,
// kanaura), the whole muharni, and the vowel carriers ੳ ਅ ੲ. Types:
// lib/learn/config.ts.
//
// AI-drafted, pending review by a fluent speaker. The carrier table is what
// learners memorize, so it needs the most careful check: ਅ takes mukta,
// kanna, dulavan and kanaura; ੲ takes sihari, bihari and lavan; ੳ takes
// aunkar, dulainkar and hora. Romanization follows the house style
// (lib/translate/romanization.ts).
//
// Open questions for that review:
// - ਈਰਖਾ (irkha, jealousy) and ਊਠ (ooth, camel) are the anchor words for
//   ਈ and ਊ. Are there more everyday ones?
// - ਓਕੇ (okay) as the anchor for ਓ: fine, or too cute?

import type { LessonBody } from '../../config';

const lesson: LessonBody = {
    sections: [
        {
            heading: 'Four more marks',
            body: [
                'The second half of the muharni adds four vowels, and all four marks sit on top of the letter: lavan and dulavan, hora and kanaura.',
            ],
            letters: [
                { glyph: 'ਕੇ', name: 'lavan', roman: 'ke', sound: 'e as in the a of cake, without the glide at the end.' },
                { glyph: 'ਕੈ', name: 'dulavan', roman: 'kai', sound: 'An open e, between bed and bad. ਹੈ (hai, is).' },
                { glyph: 'ਕੋ', name: 'hora', roman: 'ko', sound: 'o as in go, without the glide at the end.' },
                { glyph: 'ਕੌ', name: 'kanaura', roman: 'kau', sound: 'An open o, like the o of more without the r. ਕੌਣ (kaun, who).' },
            ],
        },
        {
            heading: 'The whole muharni',
            body: [
                'Chant it the way Punjabi schools do: ka kaa ki kee ku koo ke kai ko kau. Then try it on any letter: ਮ ਮਾ ਮਿ ਮੀ ਮੁ ਮੂ ਮੇ ਮੈ ਮੋ ਮੌ.',
            ],
            letters: [
                { glyph: 'ਕ', name: 'mukta', roman: 'ka', sound: 'a' },
                { glyph: 'ਕਾ', name: 'kanna', roman: 'kaa', sound: 'aa' },
                { glyph: 'ਕਿ', name: 'sihari', roman: 'ki', sound: 'i' },
                { glyph: 'ਕੀ', name: 'bihari', roman: 'kee', sound: 'ee' },
                { glyph: 'ਕੁ', name: 'aunkar', roman: 'ku', sound: 'u' },
                { glyph: 'ਕੂ', name: 'dulainkar', roman: 'koo', sound: 'oo' },
                { glyph: 'ਕੇ', name: 'lavan', roman: 'ke', sound: 'e' },
                { glyph: 'ਕੈ', name: 'dulavan', roman: 'kai', sound: 'ai' },
                { glyph: 'ਕੋ', name: 'hora', roman: 'ko', sound: 'o' },
                { glyph: 'ਕੌ', name: 'kanaura', roman: 'kau', sound: 'au' },
            ],
        },
        {
            heading: 'Vowels at the start of a word: the carriers',
            body: [
                'A vowel mark needs a letter to sit on. When a word starts with a vowel, Gurmukhi puts the mark on one of the three carriers from row one, and each carrier takes only some of the marks.',
                'The pattern: ੳ carries the u and o sounds, ੲ carries the i and e sounds, and ਅ carries the a sounds.',
            ],
            letters: [
                { glyph: 'ਅ', name: 'airha', roman: 'a', sound: 'a, as in ਅਸੀਂ (asi, we).' },
                { glyph: 'ਆ', name: 'airha kanna', roman: 'aa', sound: 'aa, as in ਆਪ (aap, you, very formal).' },
                { glyph: 'ਐ', name: 'airha dulavan', roman: 'ai', sound: 'ai, as in ਐਨਕ (ainak, glasses).' },
                { glyph: 'ਔ', name: 'airha kanaura', roman: 'au', sound: 'au, as in ਔਖਾ (aukha, difficult).' },
                { glyph: 'ਇ', name: 'eerhi sihari', roman: 'i', sound: 'i, as in ਇਹ (ih, this).' },
                { glyph: 'ਈ', name: 'eerhi bihari', roman: 'ee', sound: 'ee, as in ਈਰਖਾ (irkha, jealousy).' },
                { glyph: 'ਏ', name: 'eerhi lavan', roman: 'e', sound: 'e, as in ਏਕਤਾ (ekta, unity).' },
                { glyph: 'ਉ', name: 'oorha aunkar', roman: 'u', sound: 'u, as in ਉਮਰ (umar, age).' },
                { glyph: 'ਊ', name: 'oorha dulainkar', roman: 'oo', sound: 'oo, as in ਊਠ (ooth, camel).' },
                { glyph: 'ਓ', name: 'oorha hora', roman: 'o', sound: 'o, as in ਓਕੇ (okay).' },
            ],
            tip: 'ਉ, ਊ and ਓ each look like one letter, but they are ੳ with its mark built in.',
        },
        {
            heading: 'Between two vowels',
            body: [
                'Carriers also stand between two vowels, where a second vowel follows the first with no consonant in between. The romanization often writes that join with a y (ਗਿਆ is gaya, ਆਈ is aayi), but not always: ਜਾਓ is jao.',
            ],
            examples: [
                { gurmukhi: 'ਗਿਆ', roman: 'gaya', english: 'went (said of a man)' },
                { gurmukhi: 'ਆਈ', roman: 'aayi', english: 'came (said of a woman)' },
                { gurmukhi: 'ਜਾਓ', roman: 'jao', english: 'go (politely)' },
                { gurmukhi: 'ਆਇਆ', roman: 'aaya', english: 'came (said of a man)' },
                { gurmukhi: 'ਲਈ', roman: 'layi', english: 'for' },
            ],
        },
    ],
    quiz: [
        {
            kind: 'choice',
            prompt: 'Which carrier takes the i and e sounds?',
            choices: ['ੲ', 'ੳ', 'ਅ'],
            choicesLang: 'pa',
            answer: 'ੲ',
        },
        {
            kind: 'choice',
            prompt: 'Which of these says “ai”?',
            choices: ['ਐ', 'ਔ', 'ਏ'],
            choicesLang: 'pa',
            answer: 'ਐ',
        },
        {
            kind: 'choice',
            prompt: 'In the muharni, what comes after ke?',
            choices: ['kai', 'ko', 'kee'],
            choicesLang: 'pa-Latn',
            answer: 'kai',
        },
        {
            kind: 'typed',
            prompt: 'Read this word. It means difficult.',
            promptPa: 'ਔਖਾ',
            answer: 'aukha',
        },
        {
            kind: 'typed',
            prompt: 'Read this word. It means this.',
            promptPa: 'ਇਹ',
            answer: 'ih',
            accept: ['eh', 'ehh'],
        },
        {
            kind: 'typed',
            prompt: 'Read this word. It means who.',
            promptPa: 'ਕੌਣ',
            answer: 'kaun',
        },
        {
            kind: 'typed',
            prompt: 'Read this word. It means age.',
            promptPa: 'ਉਮਰ',
            answer: 'umar',
        },
    ],
};

export default lesson;
