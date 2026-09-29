// Grammar track, lesson 3: possession with da, di, de, dian, and the
// possessive pronouns. Types: lib/learn/config.ts.
//
// AI-drafted, pending review by a fluent speaker. Spellings follow the
// phrasebook, then the romanized interface for frequent words (saada,
// saade, unhan), then the house rules (see grammar lesson 1's header).
//
// Open questions for that review:
// - The tip says speakers use the plural possessive for a woman elder too
//   (mere mata ji). Common enough to teach?
// - ਤੁਹਾਡਾ ਨਾਮ, with ਨਾਮ, sidesteps the phrasebook's open question about
//   ਨਾਂ (naam or naan).

import type { LessonBody } from '../../config';

const lesson: LessonBody = {
    sections: [
        {
            heading: 'da, di, de: the Punjabi ’s',
            body: [
                'Punjabi puts the owner first, then ਦਾ, ਦੀ or ਦੇ, then the thing owned: ਪਾਪਾ ਦਾ ਫ਼ੋਨ (Papa da phone), Dad’s phone. Think of it as an ’s that stands after the owner as a word of its own.',
                'The ending agrees with the thing owned, not with the owner: da for a masculine thing, di for a feminine one, de for masculine plural, and dian for feminine plural.',
            ],
            examples: [
                { gurmukhi: 'ਪਾਪਾ ਦਾ ਫ਼ੋਨ', roman: 'Papa da phone', english: 'Dad’s phone', note: 'ਫ਼ੋਨ is masculine.' },
                { gurmukhi: 'ਮੰਮੀ ਦੀ ਗੱਡੀ', roman: 'Mummy di gaddi', english: 'Mom’s car', note: 'ਗੱਡੀ is feminine.' },
                { gurmukhi: 'ਗੁਰੂ ਦਾ ਲੰਗਰ', roman: 'Guru da langar', english: 'the Guru’s langar' },
                { gurmukhi: 'ਅੱਜ ਦਾ ਹੁਕਮਨਾਮਾ', roman: 'Ajj da Hukamnama', english: 'today’s Hukamnama' },
                { gurmukhi: 'ਪੰਜਾਬ ਦੀਆਂ ਗੱਲਾਂ', roman: 'Punjab dian gallan', english: 'stories of Punjab', note: 'ਗੱਲਾਂ is feminine plural, so dian.' },
            ],
        },
        {
            heading: 'My, your, our',
            body: [
                'The possessive words work the same way, with the same endings. His and her are one word: ਉਸ ਦਾ ਘਰ is his house or her house. Only the thing owned matters.',
            ],
            examples: [
                { gurmukhi: 'ਮੇਰਾ, ਮੇਰੀ, ਮੇਰੇ', roman: 'mera, meri, mere', english: 'my' },
                { gurmukhi: 'ਤੇਰਾ, ਤੇਰੀ, ਤੇਰੇ', roman: 'tera, teri, tere', english: 'your, to a close friend or a child' },
                { gurmukhi: 'ਤੁਹਾਡਾ, ਤੁਹਾਡੀ, ਤੁਹਾਡੇ', roman: 'tuhada, tuhadi, tuhade', english: 'your, respectfully or to more than one' },
                { gurmukhi: 'ਸਾਡਾ, ਸਾਡੀ, ਸਾਡੇ', roman: 'saada, saadi, saade', english: 'our' },
                { gurmukhi: 'ਉਸ ਦਾ, ਉਸ ਦੀ, ਉਸ ਦੇ', roman: 'us da, us di, us de', english: 'his, her, its' },
                { gurmukhi: 'ਉਹਨਾਂ ਦਾ, ਉਹਨਾਂ ਦੀ, ਉਹਨਾਂ ਦੇ', roman: 'unhan da, unhan di, unhan de', english: 'their; his or her, respectfully' },
            ],
        },
        {
            heading: 'In sentences',
            body: [
                'Put together, these are some of the first sentences anyone says about their family.',
            ],
            examples: [
                { gurmukhi: 'ਇਹ ਮੇਰਾ ਪਰਿਵਾਰ ਹੈ', roman: 'Ih mera parivaar hai', english: 'This is my family' },
                { gurmukhi: 'ਤੁਹਾਡਾ ਨਾਮ ਕੀ ਹੈ?', roman: 'Tuhada naam ki hai?', english: 'What is your name?' },
                { gurmukhi: 'ਮੇਰੀ ਭੈਣ ਡਾਕਟਰ ਹੈ', roman: 'Meri bhain doctor hai', english: 'My sister is a doctor' },
                { gurmukhi: 'ਸਾਡੇ ਚਾਚਾ ਜੀ ਆਏ ਹਨ', roman: 'Saade chacha ji aaye han', english: 'Our uncle has come', note: 'Saade and aaye are plural out of respect (lesson 10).' },
                { gurmukhi: 'ਉਸ ਦੀ ਕਿਤਾਬ ਕਿੱਥੇ ਹੈ?', roman: 'Us di kitaab kithe hai?', english: 'Where is his (or her) book?' },
            ],
            tip: 'Before an elder, the plural shows respect: mere papa ji, not mera. Many speakers do the same for women: mere mata ji.',
        },
    ],
    quiz: [
        {
            kind: 'choice',
            prompt: 'Mom’s car: Mummy ___ gaddi',
            choices: ['di', 'da', 'de'],
            choicesLang: 'pa-Latn',
            answer: 'di',
            explanation: 'ਗੱਡੀ (car) is feminine, and the ending follows the thing owned.',
        },
        {
            kind: 'choice',
            prompt: 'Dad’s phone: Papa ___ phone',
            choices: ['da', 'di', 'dian'],
            choicesLang: 'pa-Latn',
            answer: 'da',
        },
        {
            kind: 'choice',
            prompt: 'Your name (respectfully): ___ naam',
            choices: ['tuhada', 'tera', 'tuhadi'],
            choicesLang: 'pa-Latn',
            answer: 'tuhada',
        },
        {
            kind: 'choice',
            prompt: 'Our house: ___ ghar',
            choices: ['saada', 'saadi', 'saade'],
            choicesLang: 'pa-Latn',
            answer: 'saada',
        },
        {
            kind: 'choice',
            prompt: 'ਉਸ ਦਾ ਘਰ (us da ghar) means…',
            choices: ['His house or her house', 'Only his house', 'Their house'],
            answer: 'His house or her house',
        },
        {
            kind: 'typed',
            prompt: 'Ask “What is your name?” respectfully.',
            answer: 'Tuhada naam ki hai?',
        },
        {
            kind: 'typed',
            prompt: 'Say “This is my family.”',
            answer: 'Ih mera parivaar hai',
            accept: ['Eh mera parivaar hai'],
        },
    ],
};

export default lesson;
