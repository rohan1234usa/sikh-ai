// Script track, lesson 7: the nasal marks bindi and tippi, addak, and the
// subjoined letters ੍ਹ ੍ਰ ੍ਵ. Types: lib/learn/config.ts.
//
// AI-drafted, pending review by a fluent speaker. The tippi and bindi rule
// needs a careful check: tippi with mukta, sihari, aunkar and dulainkar;
// bindi with every other mark, and with the vowel letters ਈ and ਊ.
// Romanization follows the house style (ROMANIZATION in
// lib/translate/prompts.ts): addak doubles a letter in the roman too, except
// ch, chh, kh and th, and a nasal after a final ੀ or ੂ isn't written.
//
// Open questions for that review:
// - Subjoined ਵ gets no example word. Is there a common one?
// - ਪਤਾ / ਪੱਤਾ (pata, patta) as the addak minimal pair.

import type { LessonBody } from '../../config';

const lesson: LessonBody = {
    sections: [
        {
            heading: 'Bindi and tippi: a vowel through the nose',
            body: [
                'Two marks make a vowel nasal: bindi (◌ਂ), a dot on top, and tippi (◌ੰ), a small curve on top. They do the same job; which one a word uses depends on its vowel mark.',
                'Tippi goes with the bare letter, sihari, aunkar and dulainkar: ਪੰਜ, ਸਿੰਘ, ਮੁੰਡਾ, ਮੈਨੂੰ. Bindi goes with the other marks: ਮੈਂ, ਹਾਂ, ਨਹੀਂ. The vowel letters ਈ and ਊ take bindi too.',
                'Before a consonant, the nasal often sounds as an n or m that belongs to the next letter: ਪੰਜ is panj. The romanization writes it as n or m, the way it is heard, and not at all after a final ee or oo sound: ਨਹੀਂ is nahi, ਮੈਨੂੰ is mainu.',
            ],
            examples: [
                { gurmukhi: 'ਪੰਜ', roman: 'panj', english: 'five' },
                { gurmukhi: 'ਸਿੰਘ', roman: 'Singh', english: 'Singh', note: 'Sihari with tippi.' },
                { gurmukhi: 'ਮੁੰਡਾ', roman: 'munda', english: 'boy', note: 'Aunkar with tippi.' },
                { gurmukhi: 'ਮੈਂ', roman: 'main', english: 'I', note: 'Dulavan with bindi.' },
                { gurmukhi: 'ਹਾਂ', roman: 'haan', english: 'yes; am (as in main haan, I am)', note: 'Kanna with bindi.' },
                { gurmukhi: 'ਨਹੀਂ', roman: 'nahi', english: 'no, not', note: 'Bihari with bindi.' },
                { gurmukhi: 'ਮੈਨੂੰ', roman: 'mainu', english: 'to me', note: 'Dulainkar with tippi.' },
            ],
        },
        {
            heading: 'Addak: holding a letter twice as long',
            body: [
                'Addak (◌ੱ), a small curve over a letter, doubles the consonant after it: you hold that consonant a moment longer. It can change the meaning.',
                'The romanization writes the doubled letter twice (ਗੱਲ gall, ਦੱਸੋ dasso, ਅੱਜ ajj), except ch, chh, kh and th, which stay single so words stay readable: ਅੱਛਾ achha, ਵਿੱਚ vich, ਸਿੱਖ Sikh, ਮੱਥਾ matha.',
            ],
            examples: [
                { gurmukhi: 'ਪਤਾ', roman: 'pata', english: 'address; knowing', note: 'As in mainu pata hai, I know.' },
                { gurmukhi: 'ਪੱਤਾ', roman: 'patta', english: 'leaf', note: 'The same letters as ਪਤਾ, with the t held twice as long.' },
                { gurmukhi: 'ਗੱਲ', roman: 'gall', english: 'talk; a matter' },
                { gurmukhi: 'ਅੱਜ', roman: 'ajj', english: 'today' },
                { gurmukhi: 'ਸਿੱਖ', roman: 'Sikh', english: 'Sikh; a learner' },
            ],
        },
        {
            heading: 'Letters written underneath',
            body: [
                'Three letters have a half form that tucks under the letter before, with no vowel between them: ਹ, ਰ and ਵ.',
                'A ਹ underneath (੍ਹ) usually becomes a tone rather than an h (lesson 8), after the flap ੜ most of all: ਪੜ੍ਹੋ, ਥੋੜ੍ਹਾ. A ਰ underneath (੍ਰ) is an r straight after the letter: ਪ੍ਰੇਮ, ਸ੍ਰੀ. A ਵ underneath (੍ਵ) is rare in everyday Punjabi; you will see it now and then in Gurbani.',
            ],
            examples: [
                { gurmukhi: 'ਪੜ੍ਹੋ', roman: 'parho', english: 'read (politely)' },
                { gurmukhi: 'ਥੋੜ੍ਹਾ', roman: 'thorha', english: 'a little' },
                { gurmukhi: 'ਪ੍ਰੇਮ', roman: 'prem', english: 'love' },
                { gurmukhi: 'ਸ੍ਰੀ', roman: 'Sri', english: 'Sri, a title of honor', note: 'As in Sri Guru Granth Sahib Ji. ਸਿਰੀ is the same word, spelled out.' },
            ],
        },
    ],
    quiz: [
        {
            kind: 'choice',
            prompt: 'A word has kanna (◌ਾ) and a nasal sound. Which mark does it use?',
            choices: ['bindi', 'tippi'],
            choicesLang: 'pa-Latn',
            answer: 'bindi',
            explanation: 'Tippi goes only with the bare letter, sihari, aunkar and dulainkar: ਹਾਂ takes bindi.',
        },
        {
            kind: 'choice',
            prompt: 'What does addak (◌ੱ) do?',
            choices: ['Doubles the next consonant', 'Makes the vowel long', 'Makes the vowel nasal'],
            answer: 'Doubles the next consonant',
        },
        {
            kind: 'choice',
            prompt: 'Which word means “a little”?',
            choices: ['ਥੋੜ੍ਹਾ', 'ਪੜ੍ਹੋ', 'ਪ੍ਰੇਮ'],
            choicesLang: 'pa',
            answer: 'ਥੋੜ੍ਹਾ',
        },
        {
            kind: 'typed',
            prompt: 'Read this word. It means five.',
            promptPa: 'ਪੰਜ',
            answer: 'panj',
        },
        {
            kind: 'typed',
            prompt: 'Read this word. It means leaf.',
            promptPa: 'ਪੱਤਾ',
            answer: 'patta',
        },
        {
            kind: 'typed',
            prompt: 'Read this word. It means today.',
            promptPa: 'ਅੱਜ',
            answer: 'ajj',
        },
        {
            kind: 'typed',
            prompt: 'Read this word. It means no.',
            promptPa: 'ਨਹੀਂ',
            answer: 'nahi',
            accept: ['nahin', 'nai'],
        },
    ],
};

export default lesson;
