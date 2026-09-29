// Script track, lesson 5: the first five vowel signs (kanna, sihari, bihari,
// aunkar, dulainkar) and how the house romanization spells them. Types:
// lib/learn/config.ts.
//
// AI-drafted, pending review by a fluent speaker. The sign cards show each
// vowel's sound (kaa, kee, koo), the way the muharni is chanted; the words
// show the house spelling (lib/translate/romanization.ts), which
// writes a vowel at the end of a word with one letter (ki, ji, pani) and
// doubles a long vowel only in a word's last syllable (kitaab, door), apart
// from the customary spellings the other lessons keep (aao, aaya, saada,
// saanu, baare). The lesson explains the difference.
//
// Open questions for that review:
// - Sound descriptions use American English anchors (father, bit, see, put,
//   food). Are any of them misleading for Punjabi vowels?

import type { LessonBody } from '../../config';

const lesson: LessonBody = {
    sections: [
        {
            heading: 'Vowels are marks on letters',
            body: [
                'A letter on its own says a short “a”; that bare vowel is called mukta. For any other vowel, Gurmukhi adds a mark to the letter. There are nine marks, and with mukta they make ten vowels.',
                'Every Punjabi school child chants them on ਕ, in order: ka kaa ki kee ku koo ke kai ko kau. That chant is the muharni. This lesson covers its first half: short and long a, i and u.',
            ],
        },
        {
            heading: 'Five marks, and the bare letter',
            body: [
                'Each short vowel has a long partner. Notice where each mark sits: one sits before the letter even though you say it after.',
            ],
            letters: [
                { glyph: 'ਕ', name: 'mukta', roman: 'ka', sound: 'No mark: the letter’s own short a, as in about.' },
                { glyph: 'ਕਾ', name: 'kanna', roman: 'kaa', sound: 'A long aa, as in father. The stroke after the letter.' },
                { glyph: 'ਕਿ', name: 'sihari', roman: 'ki', sound: 'A short i, as in bit. Written before the letter, said after it.' },
                { glyph: 'ਕੀ', name: 'bihari', roman: 'kee', sound: 'A long ee, as in see. The stroke after the letter.' },
                { glyph: 'ਕੁ', name: 'aunkar', roman: 'ku', sound: 'A short u, as in put. One hook under the letter.' },
                { glyph: 'ਕੂ', name: 'dulainkar', roman: 'koo', sound: 'A long oo, as in food. Two hooks under the letter.' },
            ],
            tip: 'Sihari is the one that fools everyone: ਕਿ looks like “i-k” and says “ki”.',
        },
        {
            heading: 'Reading words',
            body: [
                'These words use only the marks above. Read the Gurmukhi first, then check the line under it.',
            ],
            examples: [
                { gurmukhi: 'ਪਾਣੀ', roman: 'pani', english: 'water' },
                { gurmukhi: 'ਦਿਲ', roman: 'dil', english: 'heart' },
                { gurmukhi: 'ਕਿਤਾਬ', roman: 'kitaab', english: 'book' },
                { gurmukhi: 'ਦਾਦੀ', roman: 'dadi', english: 'grandmother, your father’s mother' },
                { gurmukhi: 'ਗੁਰੂ', roman: 'Guru', english: 'the Guru' },
                { gurmukhi: 'ਦੂਰ', roman: 'door', english: 'far, far away' },
                { gurmukhi: 'ਸੁਣ', roman: 'sun', english: 'listen', note: 'Said to a friend or a child. To an elder, it’s suno.' },
            ],
        },
        {
            heading: 'How the romanization spells them',
            body: [
                'The muharni above shows sounds. Words are spelled the way families text, which follows three habits.',
                'A vowel at the end of a word is one letter: ਪਾਣੀ is pani, ਗੁਰੂ is Guru, ਕੀ is ki.',
                'A long vowel in a word’s last syllable, or in a one-syllable word, is doubled so you hear its length: ਕਿਤਾਬ kitaab, ਦੂਰ door, ਠੀਕ theek.',
                'Anywhere else a long vowel is written once: ਪਾਣੀ is pani, not paani, and ਚਾਚਾ is chacha. When the spelling leaves you unsure, the Gurmukhi never does.',
                'A few everyday words keep the doubled spelling families already use. ਆ at the start of a word is aa, so ਆਓ is aao and ਆਇਆ is aaya, and ਸਾਡਾ, ਸਾਨੂੰ and ਬਾਰੇ are saada, saanu and baare.',
            ],
        },
    ],
    quiz: [
        {
            kind: 'choice',
            prompt: 'Which mark makes a long aa?',
            choices: ['◌ਾ', '◌ਿ', '◌ੁ'],
            choicesLang: 'pa',
            answer: '◌ਾ',
        },
        {
            kind: 'choice',
            prompt: 'Sihari (◌ਿ) is written before its letter. When do you say it?',
            choices: ['After the letter', 'Before the letter'],
            answer: 'After the letter',
        },
        {
            kind: 'choice',
            prompt: 'Which of these says koo?',
            choices: ['ਕੂ', 'ਕੁ', 'ਕੀ'],
            choicesLang: 'pa',
            answer: 'ਕੂ',
        },
        {
            kind: 'typed',
            prompt: 'Read this word. It means water.',
            promptPa: 'ਪਾਣੀ',
            answer: 'pani',
        },
        {
            kind: 'typed',
            prompt: 'Read this word. It means heart.',
            promptPa: 'ਦਿਲ',
            answer: 'dil',
            strict: true,
            explanation: 'Sihari is a short i, so ਦਿਲ is dil. The long ee is bihari (◌ੀ).',
        },
        {
            kind: 'typed',
            prompt: 'Read this word. It means book.',
            promptPa: 'ਕਿਤਾਬ',
            answer: 'kitaab',
            accept: ['kitab'],
            strict: true,
            explanation: 'Sihari makes the first vowel short and kanna the second long: kitaab, or kitab, but never keetaab.',
        },
        {
            kind: 'typed',
            prompt: 'Read this word. It means far.',
            promptPa: 'ਦੂਰ',
            answer: 'door',
            accept: ['dur'],
        },
    ],
};

export default lesson;
