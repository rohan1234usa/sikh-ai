// Script track, lesson 4: the six letters with a dot underneath (pair bindi),
// and Gurmukhi digits. Types: lib/learn/config.ts.
//
// AI-drafted, pending review by a fluent speaker. Romanization follows the
// house style (ROMANIZATION in lib/translate/prompts.ts). The digit cards put
// the Punjabi number word in `name` and the digit itself in `roman`.
//
// Open questions for that review:
// - ਲ਼ is described without an example word, because writers use it so
//   unevenly. Is there one everyday word worth showing?
// - Number words: ikk, do, tinn, chaar, panj, chhe, satt, ath, naun, sifar.
//   ਅੱਠ is "ath" because the house rule keeps th single under addak.

import type { LessonBody } from '../../config';

const lesson: LessonBody = {
    sections: [
        {
            heading: 'A dot for borrowed sounds',
            body: [
                'Persian, Arabic and English brought Punjabi sounds its alphabet had no letter for: z, f, sh, and a throaty kh and gh. Gurmukhi writes them by putting a dot, the pair bindi (“foot dot”), under the nearest letter.',
                'Writers aren’t consistent about it. The same word may appear as ਜ਼ਿੰਦਗੀ or ਜਿੰਦਗੀ, and many people say z as j anyway. When you see the dot, say the borrowed sound; when you don’t, it is still the same word.',
            ],
            letters: [
                { glyph: 'ਸ਼', name: 'sassa pair bindi', roman: 'sh', sound: 'sh as in shoe.' },
                { glyph: 'ਖ਼', name: 'khakha pair bindi', roman: 'kh', sound: 'A throaty kh, like the ch in the Scottish “loch”.' },
                { glyph: 'ਗ਼', name: 'gagga pair bindi', roman: 'gh', sound: 'A gargled g, from the back of the throat.' },
                { glyph: 'ਜ਼', name: 'jajja pair bindi', roman: 'z', sound: 'z as in zoo.' },
                { glyph: 'ਫ਼', name: 'phaffa pair bindi', roman: 'f', sound: 'f as in fun.' },
                { glyph: 'ਲ਼', name: 'lalla pair bindi', roman: 'l', sound: 'An l with the tongue curled back. Many writers leave its dot off.' },
            ],
            examples: [
                { gurmukhi: 'ਸ਼ਬਦ', roman: 'shabad', english: 'word; a hymn of Gurbani' },
                { gurmukhi: 'ਖ਼ਾਲਸਾ', roman: 'Khalsa', english: 'the Khalsa' },
                { gurmukhi: 'ਜ਼ਿੰਦਗੀ', roman: 'zindagi', english: 'life' },
                { gurmukhi: 'ਫ਼ਤਹਿ', roman: 'Fateh', english: 'victory', note: 'As in Waheguru Ji Ki Fateh.' },
                { gurmukhi: 'ਸ਼ੁਕਰ', roman: 'shukar', english: 'thanks, gratitude', note: 'Shukar hai: thank goodness.' },
            ],
        },
        {
            heading: 'Gurmukhi digits',
            body: [
                'Gurmukhi has its own digits. You will see them on every Ang of Sri Guru Granth Sahib Ji, in the numbers that close each verse, on calendars and on Gurdwara signs. Everyday writing, and this site, mostly use 0 to 9.',
                'They work exactly like the digits you know: ੧੯ is 19, and ੧੪੩੦ is 1430.',
            ],
            letters: [
                { glyph: '੦', name: 'sifar', roman: '0', sound: 'zero' },
                { glyph: '੧', name: 'ikk', roman: '1', sound: 'one' },
                { glyph: '੨', name: 'do', roman: '2', sound: 'two' },
                { glyph: '੩', name: 'tinn', roman: '3', sound: 'three' },
                { glyph: '੪', name: 'chaar', roman: '4', sound: 'four' },
                { glyph: '੫', name: 'panj', roman: '5', sound: 'five' },
                { glyph: '੬', name: 'chhe', roman: '6', sound: 'six' },
                { glyph: '੭', name: 'satt', roman: '7', sound: 'seven' },
                { glyph: '੮', name: 'ath', roman: '8', sound: 'eight' },
                { glyph: '੯', name: 'naun', roman: '9', sound: 'nine' },
            ],
            examples: [
                { gurmukhi: 'ਅੰਗ ੧੪੩੦', roman: 'Ang 1430', english: 'Ang 1430, the last page of Sri Guru Granth Sahib Ji' },
                { gurmukhi: '੨੦੨੬', roman: '2026', english: 'the year 2026' },
            ],
            tip: 'Verse numbers sit between double dandas: ॥੧॥ closes verse 1, and ॥੧॥ ਰਹਾਉ ॥ marks the Rahao, the line a shabad turns on.',
        },
    ],
    quiz: [
        {
            kind: 'choice',
            prompt: 'What does the dot under ਜ਼ do?',
            choices: ['Turns j into z', 'Turns j into y', 'Makes the letter silent'],
            answer: 'Turns j into z',
        },
        {
            kind: 'choice',
            prompt: 'You see ਜਿੰਦਗੀ, without the dot. Is it the same word as ਜ਼ਿੰਦਗੀ?',
            choices: ['Yes, the same word', 'No, a different word'],
            answer: 'Yes, the same word',
            explanation: 'Writers often leave the dot off. The word, life, doesn’t change.',
        },
        {
            kind: 'typed',
            prompt: 'Read this word. It means a hymn of Gurbani.',
            promptPa: 'ਸ਼ਬਦ',
            answer: 'shabad',
        },
        {
            kind: 'choice',
            prompt: 'Which is the digit 5?',
            choices: ['੫', '੬', '੯'],
            choicesLang: 'pa',
            answer: '੫',
        },
        {
            kind: 'typed',
            prompt: 'Write this year in ordinary digits.',
            promptPa: '੨੦੨੬',
            answer: '2026',
        },
        {
            kind: 'typed',
            prompt: 'Which Ang is this? Write it in ordinary digits.',
            promptPa: '੧੪੩੦',
            answer: '1430',
        },
    ],
};

export default lesson;
