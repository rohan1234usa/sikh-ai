// Grammar track, lesson 2: gender, plurals, and agreement of adjectives and
// verbs. Types: lib/learn/config.ts.
//
// AI-drafted, pending review by a fluent speaker. Spellings follow the
// phrasebook, then the romanized interface for frequent words, then the
// house rules (see grammar lesson 1's header). By the house rules a long
// vowel is written once outside a word's last syllable, so kitaab's plural
// is kitaban.
//
// Open questions for that review:
// - Is "consonant-ending adjectives never change" safe as a rule of thumb?
// - ਥੱਕਿਆ ਹੋਇਆ / ਥੱਕੀ ਹੋਈ for tired, spelled thakkia hoya / thakki hoyi.

import type { LessonBody } from '../../config';

const lesson: LessonBody = {
    sections: [
        {
            heading: 'Every noun is masculine or feminine',
            body: [
                'Punjabi sorts every noun into masculine or feminine, even things; there is no “it”. ਕਮਰਾ (kamra, room) is masculine, and ਰੋਟੀ (roti) is feminine.',
                'The ending is the best clue. Nouns ending in -a (ਾ) are usually masculine, and nouns ending in -i (ੀ) are usually feminine. A noun ending in a consonant has to be learned with its gender: ਘਰ (ghar, home) is masculine, and ਕਿਤਾਬ (kitaab, book) is feminine.',
            ],
            examples: [
                { gurmukhi: 'ਮੁੰਡਾ', roman: 'munda', english: 'boy', note: 'Masculine.' },
                { gurmukhi: 'ਕੁੜੀ', roman: 'kurhi', english: 'girl', note: 'Feminine.' },
                { gurmukhi: 'ਕਮਰਾ', roman: 'kamra', english: 'room', note: 'Masculine.' },
                { gurmukhi: 'ਰੋਟੀ', roman: 'roti', english: 'roti', note: 'Feminine.' },
                { gurmukhi: 'ਘਰ', roman: 'ghar', english: 'home, house', note: 'Masculine.' },
                { gurmukhi: 'ਕਿਤਾਬ', roman: 'kitaab', english: 'book', note: 'Feminine.' },
            ],
        },
        {
            heading: 'Plurals',
            body: [
                'Masculine -a becomes -e: ਮੁੰਡਾ, ਮੁੰਡੇ. Feminine nouns add -an: ਕੁੜੀ, ਕੁੜੀਆਂ, and ਕਿਤਾਬ, ਕਿਤਾਬਾਂ. Most masculine nouns ending in a consonant don’t change at all: one ਘਰ, two ਘਰ.',
            ],
            examples: [
                { gurmukhi: 'ਮੁੰਡੇ', roman: 'munde', english: 'boys' },
                { gurmukhi: 'ਕੁੜੀਆਂ', roman: 'kurhian', english: 'girls' },
                { gurmukhi: 'ਕਮਰੇ', roman: 'kamre', english: 'rooms' },
                { gurmukhi: 'ਰੋਟੀਆਂ', roman: 'rotian', english: 'rotis' },
                { gurmukhi: 'ਕਿਤਾਬਾਂ', roman: 'kitaban', english: 'books', note: 'The aa is written once now that it isn’t in the last syllable.' },
                { gurmukhi: 'ਦੋ ਘਰ', roman: 'do ghar', english: 'two houses' },
            ],
        },
        {
            heading: 'Adjectives agree',
            body: [
                'An adjective ending in -a changes to match its noun, with the same endings: ਚੰਗਾ (changa) for masculine, ਚੰਗੀ (changi) for feminine, ਚੰਗੇ (change) for masculine plural, and ਚੰਗੀਆਂ (changian) for feminine plural.',
                'Adjectives ending in a consonant never change: ਲਾਲ (laal, red), ਖ਼ੁਸ਼ (khush, happy), ਗਰਮ (garam, hot).',
            ],
            examples: [
                { gurmukhi: 'ਚੰਗਾ ਮੁੰਡਾ', roman: 'changa munda', english: 'a good boy' },
                { gurmukhi: 'ਚੰਗੀ ਕੁੜੀ', roman: 'changi kurhi', english: 'a good girl' },
                { gurmukhi: 'ਚੰਗੇ ਮੁੰਡੇ', roman: 'change munde', english: 'good boys' },
                { gurmukhi: 'ਚੰਗੀਆਂ ਕੁੜੀਆਂ', roman: 'changian kurhian', english: 'good girls' },
                { gurmukhi: 'ਲਾਲ ਕਮੀਜ਼', roman: 'laal kameez', english: 'a red shirt', note: 'ਕਮੀਜ਼ is feminine, and ਲਾਲ stays the same.' },
                { gurmukhi: 'ਗਰਮ ਚਾਹ', roman: 'garam chaa', english: 'hot tea' },
            ],
        },
        {
            heading: 'Verbs agree too',
            body: [
                'The same endings appear on verbs, so a verb tells you whether the subject is a man or a woman even when the pronoun is just ਉਹ (oh).',
            ],
            examples: [
                { gurmukhi: 'ਮੁੰਡਾ ਆਉਂਦਾ ਹੈ', roman: 'Munda aunda hai', english: 'The boy comes' },
                { gurmukhi: 'ਕੁੜੀ ਆਉਂਦੀ ਹੈ', roman: 'Kurhi aundi hai', english: 'The girl comes' },
                { gurmukhi: 'ਉਹ ਥੱਕਿਆ ਹੋਇਆ ਹੈ', roman: 'Oh thakkia hoya hai', english: 'He is tired' },
                { gurmukhi: 'ਉਹ ਥੱਕੀ ਹੋਈ ਹੈ', roman: 'Oh thakki hoyi hai', english: 'She is tired' },
            ],
            tip: 'If you are a woman, practice your own forms out loud: main sakdi haan, main thakki hoyi haan. Many learners only ever heard the masculine ones.',
        },
    ],
    quiz: [
        {
            kind: 'choice',
            prompt: 'ਰੋਟੀ (roti) is…',
            choices: ['Feminine', 'Masculine'],
            answer: 'Feminine',
        },
        {
            kind: 'choice',
            prompt: 'The plural of munda (boy) is…',
            choices: ['munde', 'mundian', 'mundan'],
            choicesLang: 'pa-Latn',
            answer: 'munde',
        },
        {
            kind: 'choice',
            prompt: 'A good girl: ___ kurhi',
            choices: ['changi', 'changa', 'change'],
            choicesLang: 'pa-Latn',
            answer: 'changi',
        },
        {
            kind: 'choice',
            prompt: 'Laal (red) with a feminine noun is…',
            choices: ['laal', 'laali'],
            choicesLang: 'pa-Latn',
            answer: 'laal',
            explanation: 'Adjectives that end in a consonant never change.',
        },
        {
            kind: 'choice',
            prompt: 'A woman says “I can”: Main ___ haan',
            choices: ['sakdi', 'sakda', 'sakde'],
            choicesLang: 'pa-Latn',
            answer: 'sakdi',
        },
        {
            kind: 'typed',
            prompt: 'Say “The girl comes.”',
            answer: 'Kurhi aundi hai',
        },
        {
            kind: 'typed',
            prompt: 'Say “good boys”.',
            answer: 'change munde',
        },
    ],
};

export default lesson;
