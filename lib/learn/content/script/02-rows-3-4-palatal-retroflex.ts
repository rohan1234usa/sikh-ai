// Script track, lesson 2: rows three and four of the alphabet, the ch/j row
// and the retroflex row. Types: lib/learn/config.ts.
//
// AI-drafted, pending review by a fluent speaker. Romanization follows the
// house style (ROMANIZATION in lib/translate/prompts.ts), which writes the
// retroflex and dental sets alike (t, th, d, dh, n), as families text them;
// this lesson says so, and leans on the Gurmukhi to tell them apart. Letter
// names keep the spellings Punjabi schools teach.
//
// Open questions for that review:
// - The name of ਣ is given as "nana", the way it is usually written in
//   English letters; it collides with ਨਾਨਾ (Nana, mother's father).
// - ਞ as "nyanya", and "rare outside Gurbani".
// - Is "an American t is closer to ਟ than to ਤ" a fair way to put it?

import type { LessonBody } from '../../config';

const lesson: LessonBody = {
    sections: [
        {
            heading: 'Row three: ch and j',
            body: [
                'Row three is said with the middle of the tongue against the roof of the mouth. It follows the same pattern as row two: plain, with a puff of air, voiced, a tone letter, and a nasal.',
            ],
            letters: [
                { glyph: 'ਚ', name: 'chachcha', roman: 'ch', sound: 'ch as in church, with no puff of air.' },
                { glyph: 'ਛ', name: 'chhachha', roman: 'chh', sound: 'The same ch with a strong puff of air.' },
                { glyph: 'ਜ', name: 'jajja', roman: 'j', sound: 'j as in jam.' },
                { glyph: 'ਝ', name: 'jhajja', roman: 'jh', sound: 'Written jh, but it makes a tone rather than a breathy j (lesson 8).' },
                { glyph: 'ਞ', name: 'nyanya', roman: 'ny', sound: 'The ny of canyon. Rare outside Gurbani.' },
            ],
            examples: [
                { gurmukhi: 'ਜਨਮ', roman: 'janam', english: 'birth', note: 'As in ਜਨਮ ਦਿਨ (janam din), birthday.' },
                { gurmukhi: 'ਚਮਚਾ', roman: 'chamcha', english: 'spoon', note: 'Also slang for a flatterer.' },
                { gurmukhi: 'ਛੇ', roman: 'chhe', english: 'six' },
                { gurmukhi: 'ਝਰਨਾ', roman: 'jharna', english: 'waterfall', note: 'Starts with ਝ, the tone letter of this row.' },
            ],
        },
        {
            heading: 'Row four: the tongue curled back',
            body: [
                'This is the row English speakers have to learn with their tongue. For ਟ ਠ ਡ ਢ ਣ, curl the tip of your tongue back until it touches the roof of your mouth behind the ridge, then let go. The sound is heavier and hollower than an English t or d.',
                'Punjabi has two sets where English has one: this curled-back set, and a set said with the tongue against the teeth (lesson 3). An American t and d are closer to this row. That is why Punjabi writes English words like “doctor” and “TV” with ਡ and ਟ: ਡਾਕਟਰ, ਟੀਵੀ.',
                'The romanization writes both sets as t and d, the way families text. Only the Gurmukhi tells you which one a word uses, which is one of the best reasons to read it.',
            ],
            letters: [
                { glyph: 'ਟ', name: 'tainka', roman: 't', sound: 't with the tongue curled back, no puff of air.' },
                { glyph: 'ਠ', name: 'thattha', roman: 'th', sound: 'The same, with a strong puff of air.' },
                { glyph: 'ਡ', name: 'dadda', roman: 'd', sound: 'd with the tongue curled back, as in ਡਾਕਟਰ (doctor).' },
                { glyph: 'ਢ', name: 'dhadda', roman: 'dh', sound: 'Written dh, but it makes a tone rather than a breathy d (lesson 8).' },
                { glyph: 'ਣ', name: 'nana', roman: 'n', sound: 'n with the tongue curled back. It never starts a word.' },
            ],
            examples: [
                { gurmukhi: 'ਡਰ', roman: 'dar', english: 'fear' },
                { gurmukhi: 'ਮਟਰ', roman: 'matar', english: 'peas' },
                { gurmukhi: 'ਡਾਕਟਰ', roman: 'doctor', english: 'doctor', note: 'An English word keeps its English spelling in the romanization.' },
                { gurmukhi: 'ਪਾਣੀ', roman: 'pani', english: 'water', note: 'ਣ in the middle of a word, where it always is.' },
            ],
            tip: 'Can’t hear it yet? Say “doctor” the way your parents do. That first sound is ਡ.',
        },
    ],
    quiz: [
        {
            kind: 'choice',
            prompt: 'How are ਟ ਠ ਡ ਢ ਣ said?',
            choices: ['With the tongue curled back', 'With the tongue against the teeth', 'With the lips'],
            answer: 'With the tongue curled back',
        },
        {
            kind: 'choice',
            prompt: 'ਛ is ਚ with…',
            choices: ['a puff of air', 'a tone', 'the tongue curled back'],
            answer: 'a puff of air',
        },
        {
            kind: 'choice',
            prompt: 'Which letter starts the Punjabi word for “doctor”?',
            choices: ['ਡ', 'ਦ', 'ਧ'],
            choicesLang: 'pa',
            answer: 'ਡ',
            explanation: 'English d is closer to the curled-back ਡ than to ਦ, so borrowed words use ਡ.',
        },
        {
            kind: 'choice',
            prompt: 'Which of these never starts a word?',
            choices: ['ਣ', 'ਟ', 'ਜ'],
            choicesLang: 'pa',
            answer: 'ਣ',
        },
        {
            kind: 'typed',
            prompt: 'Read this word. It means fear.',
            promptPa: 'ਡਰ',
            answer: 'dar',
        },
        {
            kind: 'typed',
            prompt: 'Read this word. It means birth.',
            promptPa: 'ਜਨਮ',
            answer: 'janam',
        },
        {
            kind: 'typed',
            prompt: 'Read this word. It means peas.',
            promptPa: 'ਮਟਰ',
            answer: 'matar',
        },
    ],
};

export default lesson;
