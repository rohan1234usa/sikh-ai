// Grammar track, lesson 10: respect in Punjabi, with tusi, ji, plural verbs
// for one elder, and Sahib. Types: lib/learn/config.ts.
//
// AI-drafted, pending review by a fluent speaker. Honorific plurals are
// socially visible, so they need a careful check, especially the plural for
// a woman elder (Mummy kehnde han). Spellings follow the phrasebook, then
// the romanized interface (unhan), then the house rules (see grammar lesson
// 1's header), with the fixed community spellings (Darbar Sahib) kept.
//
// Open questions for that review:
// - Ji? as the polite answer when someone calls your name.
// - Bhai Sahib and Bibi ji as the everyday forms of address at the
//   Gurdwara.

import type { LessonBody } from '../../config';

const lesson: LessonBody = {
    sections: [
        {
            heading: 'Tusi for one person',
            body: [
                'Say ਤੁਸੀਂ (tusi) to anyone older than you, anyone you don’t know well and anyone you respect, even though it is also the plural. ਤੂੰ (tu) is for close friends, younger siblings and children, and for Waheguru in prayer, where it means closeness, not rudeness.',
                'Tu with an elder is one of the few mistakes that can land badly. When in doubt, tusi.',
            ],
            examples: [
                { gurmukhi: 'ਤੁਸੀਂ ਕਿਵੇਂ ਹੋ?', roman: 'Tusi kiven ho?', english: 'How are you? (respectfully)' },
                { gurmukhi: 'ਤੂੰ ਕਿਵੇਂ ਹੈਂ?', roman: 'Tu kiven hain?', english: 'How are you? (to a close friend)' },
            ],
        },
        {
            heading: 'Ji',
            body: [
                'ਜੀ (ji) after a name, a title or a relation makes it respectful: ਚਾਚਾ ਜੀ, ਮਾਤਾ ਜੀ, ਸਿੰਘ ਜੀ. After yes and no it softens them: ਹਾਂਜੀ, ਨਹੀਂ ਜੀ. On its own, ਜੀ? is the polite answer when someone calls you.',
            ],
            examples: [
                { gurmukhi: 'ਚਾਚਾ ਜੀ', roman: 'Chacha ji', english: 'Uncle, your father’s younger brother' },
                { gurmukhi: 'ਮਾਤਾ ਜੀ', roman: 'Mata ji', english: 'Mother; any elderly woman' },
                { gurmukhi: 'ਜੀ?', roman: 'Ji?', english: 'Yes? (answering when someone calls you)' },
                { gurmukhi: 'ਸਤਿ ਸ੍ਰੀ ਅਕਾਲ ਜੀ', roman: 'Sat Sri Akal ji', english: 'Hello (respectfully)' },
            ],
        },
        {
            heading: 'Plural verbs for one elder',
            body: [
                'When you talk about an elder, the verb and the possessive go plural, even for one person: ਪਾਪਾ ਜੀ ਆਏ ਹਨ (Papa ji aaye han), Dad has come; ਮੇਰੇ ਦਾਦਾ ਜੀ (mere dada ji), my grandfather. Speakers do the same for women: ਮੰਮੀ ਕਹਿੰਦੇ ਹਨ (Mummy kehnde han), Mom says.',
                'The Gurus are always spoken of this way, with Ji and the plural.',
            ],
            examples: [
                { gurmukhi: 'ਪਾਪਾ ਜੀ ਆਏ ਹਨ', roman: 'Papa ji aaye han', english: 'Dad has come' },
                { gurmukhi: 'ਮੇਰੇ ਦਾਦਾ ਜੀ ਅੰਮ੍ਰਿਤਸਰ ਤੋਂ ਹਨ', roman: 'Mere dada ji Amritsar ton han', english: 'My grandfather is from Amritsar' },
                { gurmukhi: 'ਮੰਮੀ ਕਹਿੰਦੇ ਹਨ', roman: 'Mummy kehnde han', english: 'Mom says' },
                { gurmukhi: 'ਉਹਨਾਂ ਦਾ ਨਾਮ ਕੀ ਹੈ?', roman: 'Unhan da naam ki hai?', english: 'What is his (or her) name?', note: 'Unhan, the plural, for an elder.' },
                { gurmukhi: 'ਗੁਰੂ ਨਾਨਕ ਦੇਵ ਜੀ ਨੇ ਕਿਹਾ', roman: 'Guru Nanak Dev Ji ne kiha', english: 'Guru Nanak Dev Ji said' },
            ],
        },
        {
            heading: 'Sahib, Bhai and Bibi',
            body: [
                'ਸਾਹਿਬ (Sahib) honours places, scripture and people: ਦਰਬਾਰ ਸਾਹਿਬ, ਸ੍ਰੀ ਗੁਰੂ ਗ੍ਰੰਥ ਸਾਹਿਬ ਜੀ. At the Gurdwara, a man you don’t know is ਭਾਈ ਸਾਹਿਬ and a woman is ਬੀਬੀ ਜੀ.',
            ],
            examples: [
                { gurmukhi: 'ਦਰਬਾਰ ਸਾਹਿਬ', roman: 'Darbar Sahib', english: 'Darbar Sahib, the Golden Temple in Amritsar' },
                { gurmukhi: 'ਭਾਈ ਸਾਹਿਬ', roman: 'Bhai Sahib', english: 'respected brother; sir' },
                { gurmukhi: 'ਬੀਬੀ ਜੀ', roman: 'Bibi ji', english: 'respected lady; ma’am' },
            ],
        },
    ],
    quiz: [
        {
            kind: 'choice',
            prompt: 'To your grandfather: “How are you?”',
            choices: ['Tusi kiven ho?', 'Tu kiven hain?'],
            choicesLang: 'pa-Latn',
            answer: 'Tusi kiven ho?',
        },
        {
            kind: 'choice',
            prompt: 'Papa ji aaye han has a plural verb because…',
            choices: ['It shows respect', 'Two people came', 'It is the past tense'],
            answer: 'It shows respect',
        },
        {
            kind: 'choice',
            prompt: 'My grandfather, respectfully: ___ dada ji',
            choices: ['mere', 'mera', 'meri'],
            choicesLang: 'pa-Latn',
            answer: 'mere',
        },
        {
            kind: 'choice',
            prompt: 'Someone calls your name. The polite answer is…',
            choices: ['Ji?', 'Ki?', 'Haan?'],
            choicesLang: 'pa-Latn',
            answer: 'Ji?',
        },
        {
            kind: 'typed',
            prompt: 'Say “Dad has come,” respectfully.',
            answer: 'Papa ji aaye han',
            accept: ['Papa ji aaye ne', 'Papa ji aa gaye'],
        },
        {
            kind: 'typed',
            prompt: 'Say “Mom says,” respectfully.',
            answer: 'Mummy kehnde han',
            accept: ['Mummy kehnde ne', 'Mummy ji kehnde han'],
        },
    ],
};

export default lesson;
