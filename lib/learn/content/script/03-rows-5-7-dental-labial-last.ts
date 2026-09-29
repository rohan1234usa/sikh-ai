// Script track, lesson 3: rows five to seven of the alphabet, the dental
// row, the lip row and the last row. Types: lib/learn/config.ts.
//
// AI-drafted, pending review by a fluent speaker. Romanization follows the
// house style (lib/translate/romanization.ts): ਫ is ph, ਵ is v and
// ੜ is rh. Letter names keep the spellings Punjabi schools teach.
//
// Open questions for that review:
// - ਕੁੜੀ is written kurhi, by the house rule for ੜ, where many families
//   text kudi or kuri. The lesson says so.
// - Is ਵ best described as "between v and w"?

import type { LessonBody } from '../../config';

const lesson: LessonBody = {
    sections: [
        {
            heading: 'Row five: t and d against the teeth',
            body: [
                'Here is the other set. For ਤ ਥ ਦ ਧ ਨ, put the tip of your tongue against the back of your top teeth. The sound is lighter and sharper than an American t or d.',
                'Pair each letter with its curled-back twin from row four: ਤ and ਟ, ਥ and ਠ, ਦ and ਡ, ਧ and ਢ, ਨ and ਣ. Same family of sound, a different place for the tongue.',
                'In English letters their names look the same as row four’s: thattha, dadda, dhadda. Say these with the tongue on the teeth.',
            ],
            letters: [
                { glyph: 'ਤ', name: 'tatta', roman: 't', sound: 't with the tongue on the teeth, no puff of air.' },
                { glyph: 'ਥ', name: 'thattha', roman: 'th', sound: 'The same with a puff of air. Never the th of “the”.' },
                { glyph: 'ਦ', name: 'dadda', roman: 'd', sound: 'd with the tongue on the teeth.' },
                { glyph: 'ਧ', name: 'dhadda', roman: 'dh', sound: 'Written dh, but it makes a tone rather than a breathy d (lesson 8).' },
                { glyph: 'ਨ', name: 'nanna', roman: 'n', sound: 'n as in no.' },
            ],
            examples: [
                { gurmukhi: 'ਦਰ', roman: 'dar', english: 'door, doorway', note: 'Romanized like ਡਰ (dar, fear), but a different word: ਦ is on the teeth, ਡ curled back.' },
                { gurmukhi: 'ਨਰਮ', roman: 'naram', english: 'soft, gentle' },
                { gurmukhi: 'ਤਾਰਾ', roman: 'tara', english: 'star' },
                { gurmukhi: 'ਦਾਲ', roman: 'daal', english: 'lentils' },
            ],
        },
        {
            heading: 'Row six: the lips',
            body: [
                'The lip row follows the same pattern. ਫ is a p with a puff of air, and many speakers say it as an f; the romanization writes it ph.',
            ],
            letters: [
                { glyph: 'ਪ', name: 'pappa', roman: 'p', sound: 'p with no puff of air, as in spin.' },
                { glyph: 'ਫ', name: 'phaffa', roman: 'ph', sound: 'p with a puff of air, as in pin, or an f.' },
                { glyph: 'ਬ', name: 'babba', roman: 'b', sound: 'b as in bat.' },
                { glyph: 'ਭ', name: 'bhabba', roman: 'bh', sound: 'Written bh, but it makes a tone rather than a breathy b (lesson 8).' },
                { glyph: 'ਮ', name: 'mamma', roman: 'm', sound: 'm as in mother.' },
            ],
            examples: [
                { gurmukhi: 'ਫਲ', roman: 'phal', english: 'fruit' },
                { gurmukhi: 'ਪਰ', roman: 'par', english: 'but' },
                { gurmukhi: 'ਕਮਰਾ', roman: 'kamra', english: 'room' },
                { gurmukhi: 'ਭਾਰ', roman: 'bhaar', english: 'weight' },
            ],
        },
        {
            heading: 'Row seven: the rest',
            body: [
                'The last row doesn’t follow the pattern. It holds y, r, l, v, and ੜ, a sound English doesn’t have.',
                'For ੜ, curl your tongue back as for ਡ, then flick it forward so it slaps the roof of your mouth on the way out. It never starts a word. The romanization writes it rh, so it can’t be mistaken for ਡ or ਰ; families often text it as d or r (kudi, kuri).',
            ],
            letters: [
                { glyph: 'ਯ', name: 'yayya', roman: 'y', sound: 'y as in yes.' },
                { glyph: 'ਰ', name: 'rara', roman: 'r', sound: 'A tapped r, like the tt in an American “butter”.' },
                { glyph: 'ਲ', name: 'lalla', roman: 'l', sound: 'l as in love.' },
                { glyph: 'ਵ', name: 'vava', roman: 'v', sound: 'Between v and w, with the lips barely touching.' },
                { glyph: 'ੜ', name: 'rharha', roman: 'rh', sound: 'A flap: the tongue curled back, then flicked forward.' },
            ],
            examples: [
                { gurmukhi: 'ਯਾਰ', roman: 'yaar', english: 'friend, buddy' },
                { gurmukhi: 'ਰਾਤ', roman: 'raat', english: 'night' },
                { gurmukhi: 'ਲਾਲ', roman: 'laal', english: 'red' },
                { gurmukhi: 'ਕੁੜੀ', roman: 'kurhi', english: 'girl' },
            ],
        },
    ],
    quiz: [
        {
            kind: 'choice',
            prompt: 'Where does your tongue go for ਤ and ਦ?',
            choices: ['Against the back of the top teeth', 'Curled back to the roof of the mouth', 'Nowhere: they are lip sounds'],
            answer: 'Against the back of the top teeth',
        },
        {
            kind: 'choice',
            prompt: 'Which letter is the curled-back twin of ਤ?',
            choices: ['ਟ', 'ਥ', 'ਦ'],
            choicesLang: 'pa',
            answer: 'ਟ',
        },
        {
            kind: 'choice',
            prompt: 'Which letter is the flap, written rh?',
            choices: ['ੜ', 'ਰ', 'ਡ'],
            choicesLang: 'pa',
            answer: 'ੜ',
        },
        {
            kind: 'typed',
            prompt: 'Read this word. It means lentils.',
            promptPa: 'ਦਾਲ',
            answer: 'daal',
        },
        {
            kind: 'typed',
            prompt: 'Read this word. It means fruit.',
            promptPa: 'ਫਲ',
            answer: 'phal',
            explanation: 'ਫ is written ph; saying it as an f is fine.',
        },
        {
            kind: 'typed',
            prompt: 'Read this word. It means night.',
            promptPa: 'ਰਾਤ',
            answer: 'raat',
        },
        {
            kind: 'typed',
            prompt: 'Read this word. It means girl.',
            promptPa: 'ਕੁੜੀ',
            answer: 'kurhi',
            accept: ['kudi', 'kuri'],
        },
    ],
};

export default lesson;
