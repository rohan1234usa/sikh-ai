// Script track, lesson 1: how Gurmukhi works, and rows one and two of the
// alphabet. Types: lib/learn/config.ts.
//
// AI-drafted, pending review by a fluent speaker. Romanization follows the
// house style (ROMANIZATION in lib/translate/prompts.ts), and
// tests/learn/content.test.ts holds each word to one spelling across the
// lessons, the vocabulary and the phrasebook. Letter names keep the
// spellings Punjabi schools teach (oorha, eerhi, kakka) rather than the
// house rules, since they are names.
//
// Open questions for that review:
// - ਚਲ as "chal" (come on, to a friend): is the informal form fine to show
//   this early, or should the first words avoid the tu register?
// - ਙ and ਞ are described as rare outside Gurbani. Is that fair?

import type { LessonBody } from '../../config';

const lesson: LessonBody = {
    sections: [
        {
            heading: 'An alphabet that reads the way it sounds',
            body: [
                'Gurmukhi is the script Punjabi is written in, and the script of Sri Guru Granth Sahib Ji. Guru Angad Dev Ji shaped it and spread it so that everyone, not only scholars, could read. The name means “from the mouth of the Guru”.',
                'It reads left to right, like English, and it has no capital letters. Most letters hang from a line along the top, and in a word those lines join into one bar.',
                'Each letter is a consonant that already carries a short “a”: ਕ on its own says “ka”, not “k”. To write any other vowel, you add a small mark to the letter. Those marks come in lessons 5 and 6.',
                'At the end of a word the built-in “a” is usually silent: ਘਰ is “ghar”, not “ghara”.',
            ],
            examples: [
                { gurmukhi: 'ਘਰ', roman: 'ghar', english: 'home, house' },
                { gurmukhi: 'ਕਲਮ', roman: 'kalam', english: 'pen' },
                { gurmukhi: 'ਗਰਮ', roman: 'garam', english: 'hot, warm' },
                { gurmukhi: 'ਮਨ', roman: 'man', english: 'mind, heart' },
                { gurmukhi: 'ਚਲ', roman: 'chal', english: 'come on, let’s go', note: 'Said to a friend or a child. To an elder, it’s chalo.' },
            ],
        },
        {
            heading: 'The painti: 35 letters in rows of five',
            body: [
                'The traditional alphabet is called the painti, “the thirty-five”. It is laid out in seven rows of five, and the rows follow the mouth, from the throat to the lips. Learn the pattern and you can guess how most letters sound from where they sit.',
                'The first row holds the three vowel carriers and two letters, ਸ and ਹ. Rows two to six are the core: each row is one place in the mouth, and inside each one the same pattern repeats. A plain sound, the same sound with a puff of air, a voiced sound, a letter that makes a tone, and a nasal. The last row is the rest: y, r, l, v and ੜ.',
                'Six more letters are made by putting a dot under a letter, for sounds Punjabi borrowed from Persian, Arabic and English. They come in lesson 4.',
            ],
            tip: 'Punjabi schools teach the letters by name, row by row: oorha, airha, eerhi, sassa, haha; kakka, khakha, gagga, ghagga, nganga.',
        },
        {
            heading: 'Row one: the vowel carriers, ਸ and ਹ',
            body: [
                'ੳ, ਅ and ੲ are not consonants. They are carriers: a vowel mark needs a letter to sit on, so a word that starts with a vowel starts with one of these. Lesson 6 shows which vowels each one carries.',
            ],
            letters: [
                { glyph: 'ੳ', name: 'oorha', roman: 'u', sound: 'Never said alone. It carries u, oo and o.' },
                { glyph: 'ਅ', name: 'airha', roman: 'a', sound: 'Carries a, aa, ai and au. On its own it says a, as at the start of ਅਸੀਂ (asi, we).' },
                { glyph: 'ੲ', name: 'eerhi', roman: 'i', sound: 'Never said alone. It carries i, ee and e.' },
                { glyph: 'ਸ', name: 'sassa', roman: 's', sound: 's as in sun.' },
                { glyph: 'ਹ', name: 'haha', roman: 'h', sound: 'h as in hat. After a vowel it often turns into a tone instead (lesson 8).' },
            ],
        },
        {
            heading: 'Row two: from the back of the mouth',
            body: [
                'This row shows the pattern every core row follows. ਕ is a k with no puff of air, like the k in “skip”. ਖ is a k with a strong puff, like the k in “kite”. English hears those as one sound; Punjabi hears two letters. Hold your hand in front of your mouth: ਖ should blow on it, and ਕ should not.',
            ],
            letters: [
                { glyph: 'ਕ', name: 'kakka', roman: 'k', sound: 'k with no puff of air, as in skip.' },
                { glyph: 'ਖ', name: 'khakha', roman: 'kh', sound: 'k with a strong puff of air, as in kite.' },
                { glyph: 'ਗ', name: 'gagga', roman: 'g', sound: 'g as in go.' },
                { glyph: 'ਘ', name: 'ghagga', roman: 'gh', sound: 'Written gh, but it makes a tone rather than a breathy g (lesson 8).' },
                { glyph: 'ਙ', name: 'nganga', roman: 'ng', sound: 'The ng of sing. Rare outside Gurbani.' },
            ],
            examples: [
                { gurmukhi: 'ਕਲਮ', roman: 'kalam', english: 'pen', note: 'Starts with ਕ: no puff of air.' },
                { gurmukhi: 'ਘਰ', roman: 'ghar', english: 'home, house', note: 'Starts with ਘ, the tone letter of this row.' },
                { gurmukhi: 'ਗਰਮ', roman: 'garam', english: 'hot, warm', note: 'Starts with ਗ, a plain g.' },
            ],
        },
    ],
    quiz: [
        {
            kind: 'choice',
            prompt: 'How does ਕ sound on its own?',
            choices: ['k', 'ka', 'kaa'],
            choicesLang: 'pa-Latn',
            answer: 'ka',
            explanation: 'Every letter carries a short “a” until a vowel mark changes it.',
        },
        {
            kind: 'choice',
            prompt: 'Which way does Gurmukhi read?',
            choices: ['Left to right', 'Right to left', 'Top to bottom'],
            answer: 'Left to right',
        },
        {
            kind: 'choice',
            prompt: 'Which carrier can be said on its own, as “a”?',
            choices: ['ੳ', 'ਅ', 'ੲ'],
            choicesLang: 'pa',
            answer: 'ਅ',
        },
        {
            kind: 'choice',
            prompt: 'Which letter is a k with a strong puff of air?',
            choices: ['ਕ', 'ਖ', 'ਗ'],
            choicesLang: 'pa',
            answer: 'ਖ',
        },
        {
            kind: 'typed',
            prompt: 'Read this word. It means home.',
            promptPa: 'ਘਰ',
            answer: 'ghar',
            explanation: 'The last letter’s “a” is silent: ghar, not ghara.',
        },
        {
            kind: 'typed',
            prompt: 'Read this word. It means pen.',
            promptPa: 'ਕਲਮ',
            answer: 'kalam',
        },
        {
            kind: 'choice',
            prompt: 'How many letters does the painti, the traditional alphabet, have?',
            choices: ['26', '35', '41'],
            answer: '35',
            explanation: 'Thirty-five, in seven rows of five. With the six dotted letters there are 41.',
        },
    ],
};

export default lesson;
