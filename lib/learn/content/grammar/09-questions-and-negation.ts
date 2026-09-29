// Grammar track, lesson 9: questions, question words, and the ways to say
// no. Types: lib/learn/config.ts.
//
// AI-drafted, pending review by a fluent speaker. Spellings follow the
// phrasebook (Chaa peeoge keeps its own spelling, an open question there),
// then the romanized interface (kiven, kyon, kadon), then the house rules
// (see grammar lesson 1's header).
//
// Open questions for that review:
// - Ih kinne da hai? for "how much is this?".
// - Auna hai ki nahi? for "are you coming or not?".

import type { LessonBody } from '../../config';

const lesson: LessonBody = {
    sections: [
        {
            heading: 'Yes-or-no questions',
            body: [
                'A yes-or-no question can be a statement with a rising voice: ਤੁਸੀਂ ਠੀਕ ਹੋ? (Tusi theek ho?), are you okay? To make it plain, start with ਕੀ (ki). The word order stays the same.',
            ],
            examples: [
                { gurmukhi: 'ਤੁਸੀਂ ਠੀਕ ਹੋ?', roman: 'Tusi theek ho?', english: 'Are you okay?' },
                { gurmukhi: 'ਕੀ ਤੁਸੀਂ ਪੰਜਾਬੀ ਬੋਲਦੇ ਹੋ?', roman: 'Ki tusi Punjabi bolde ho?', english: 'Do you speak Punjabi?' },
                { gurmukhi: 'ਰੋਟੀ ਖਾ ਲਈ?', roman: 'Roti kha layi?', english: 'Have you eaten?' },
                { gurmukhi: 'ਚਾਹ ਪੀਓਗੇ?', roman: 'Chaa peeoge?', english: 'Will you have tea?' },
            ],
        },
        {
            heading: 'Question words',
            body: [
                'A question word sits where the answer would go, usually just before the verb, not at the front as in English: ਤੁਸੀਂ ਕਿੱਥੇ ਜਾ ਰਹੇ ਹੋ?, literally “you where going are?”',
            ],
            examples: [
                { gurmukhi: 'ਕੀ', roman: 'ki', english: 'what' },
                { gurmukhi: 'ਕੌਣ', roman: 'kaun', english: 'who' },
                { gurmukhi: 'ਕਿੱਥੇ', roman: 'kithe', english: 'where' },
                { gurmukhi: 'ਕਦੋਂ', roman: 'kadon', english: 'when' },
                { gurmukhi: 'ਕਿਵੇਂ', roman: 'kiven', english: 'how' },
                { gurmukhi: 'ਕਿਉਂ', roman: 'kyon', english: 'why' },
                { gurmukhi: 'ਕਿੰਨਾ', roman: 'kinna', english: 'how much' },
            ],
        },
        {
            heading: 'In sentences',
            body: [
                'Here they are at work. Notice where each one lands.',
            ],
            examples: [
                { gurmukhi: 'ਇਹ ਕੀ ਹੈ?', roman: 'Ih ki hai?', english: 'What is this?' },
                { gurmukhi: 'ਉਹ ਕੌਣ ਹੈ?', roman: 'Oh kaun hai?', english: 'Who is that?' },
                { gurmukhi: 'ਤੁਸੀਂ ਕਿੱਥੇ ਜਾ ਰਹੇ ਹੋ?', roman: 'Tusi kithe ja rahe ho?', english: 'Where are you going?' },
                { gurmukhi: 'ਤੁਸੀਂ ਕਦੋਂ ਆਓਗੇ?', roman: 'Tusi kadon aaoge?', english: 'When will you come?' },
                { gurmukhi: 'ਤੁਹਾਡਾ ਕੀ ਹਾਲ ਹੈ?', roman: 'Tuhada ki haal hai?', english: 'How are you? (respectfully)' },
                { gurmukhi: 'ਇਹ ਕਿੰਨੇ ਦਾ ਹੈ?', roman: 'Ih kinne da hai?', english: 'How much is this?' },
                { gurmukhi: 'ਤੁਸੀਂ ਕਿਉਂ ਹੱਸ ਰਹੇ ਹੋ?', roman: 'Tusi kyon hass rahe ho?', english: 'Why are you laughing?' },
            ],
        },
        {
            heading: 'Saying no',
            body: [
                'ਨਹੀਂ (nahi) is the everyday no and not, and ਨਹੀਂ ਸੀ (nahi si) is wasn’t. ਨਾ (na) is for commands (lesson 8) and for “or not”. To an elder, soften it: ਨਹੀਂ ਜੀ. And the safe yes is ਹਾਂਜੀ (haanji).',
            ],
            examples: [
                { gurmukhi: 'ਨਹੀਂ ਜੀ', roman: 'Nahi ji', english: 'No (respectfully)' },
                { gurmukhi: 'ਹਾਂਜੀ', roman: 'Haanji', english: 'Yes (respectfully)' },
                { gurmukhi: 'ਮੈਂ ਘਰ ਨਹੀਂ ਸੀ', roman: 'Main ghar nahi si', english: 'I wasn’t home' },
                { gurmukhi: 'ਆਉਣਾ ਹੈ ਕਿ ਨਹੀਂ?', roman: 'Auna hai ki nahi?', english: 'Are you coming or not?' },
                { gurmukhi: 'ਕੋਈ ਗੱਲ ਨਹੀਂ', roman: 'Koi gall nahi', english: 'No worries' },
            ],
        },
    ],
    quiz: [
        {
            kind: 'choice',
            prompt: 'Where?',
            choices: ['kithe', 'kadon', 'kiven'],
            choicesLang: 'pa-Latn',
            answer: 'kithe',
        },
        {
            kind: 'choice',
            prompt: 'Why?',
            choices: ['kyon', 'kaun', 'kinna'],
            choicesLang: 'pa-Latn',
            answer: 'kyon',
        },
        {
            kind: 'choice',
            prompt: 'Where does a question word usually go in Punjabi?',
            choices: ['Just before the verb', 'At the very start', 'At the very end'],
            answer: 'Just before the verb',
        },
        {
            kind: 'choice',
            prompt: 'I wasn’t home: Main ghar ___',
            choices: ['nahi si', 'na si', 'nahi hai'],
            choicesLang: 'pa-Latn',
            answer: 'nahi si',
        },
        {
            kind: 'typed',
            prompt: 'Ask “Where are you going?” respectfully.',
            answer: 'Tusi kithe ja rahe ho?',
        },
        {
            kind: 'typed',
            prompt: 'Ask “How much is this?”',
            answer: 'Ih kinne da hai?',
            accept: ['Eh kinne da hai?'],
        },
        {
            kind: 'typed',
            prompt: 'Say “No worries.”',
            answer: 'Koi gall nahi',
            accept: ['Koi gall nahin'],
        },
    ],
};

export default lesson;
