// Grammar track, lesson 7: the future with -ga, -gi, -ge, and suggestions
// with chalo and -iye. Types: lib/learn/config.ts.
//
// AI-drafted, pending review by a fluent speaker. Spellings follow the
// phrasebook (its Fer milange keeps "fer" for ਫੇਰ, an open question there),
// then the romanized interface, then the house rules (see grammar lesson
// 1's header).
//
// Open questions for that review:
// - ਉਹ ਜਾਣਗੇ as "oh jange" for they will go.
// - Is "the future is the verb's might-form plus -ga" a helpful way to put
//   it, or too technical?

import type { LessonBody } from '../../config';

const lesson: LessonBody = {
    sections: [
        {
            heading: 'Adding -ga',
            body: [
                'The future is the easiest tense. Take the verb’s “might” form (ਜਾਵਾਂ, that I go) and add -ga, -gi or -ge to match the person: ਮੈਂ ਜਾਵਾਂਗਾ (main javanga), I will go.',
            ],
            examples: [
                { gurmukhi: 'ਮੈਂ ਜਾਵਾਂਗਾ', roman: 'Main javanga', english: 'I will go (a man speaking)' },
                { gurmukhi: 'ਮੈਂ ਜਾਵਾਂਗੀ', roman: 'Main javangi', english: 'I will go (a woman speaking)' },
                { gurmukhi: 'ਤੁਸੀਂ ਜਾਓਗੇ', roman: 'Tusi jaoge', english: 'You will go' },
                { gurmukhi: 'ਉਹ ਜਾਵੇਗਾ', roman: 'Oh javega', english: 'He will go' },
                { gurmukhi: 'ਉਹ ਜਾਵੇਗੀ', roman: 'Oh javegi', english: 'She will go' },
                { gurmukhi: 'ਅਸੀਂ ਜਾਵਾਂਗੇ', roman: 'Asi javange', english: 'We will go' },
                { gurmukhi: 'ਉਹ ਜਾਣਗੇ', roman: 'Oh jange', english: 'They will go' },
            ],
        },
        {
            heading: 'Other verbs',
            body: [
                'Most verbs work the same way from their stem: ਕਰਾਂਗਾ (karanga), ਕਰੋਗੇ (karoge), ਕਰੇਗਾ (karega). ਕੱਲ੍ਹ (kal) means both yesterday and tomorrow; the tense tells you which.',
            ],
            examples: [
                { gurmukhi: 'ਮੈਂ ਕੱਲ੍ਹ ਫ਼ੋਨ ਕਰਾਂਗਾ', roman: 'Main kal phone karanga', english: 'I will call tomorrow (a man speaking)' },
                { gurmukhi: 'ਤੁਸੀਂ ਕੀ ਖਾਓਗੇ?', roman: 'Tusi ki khaoge?', english: 'What will you eat?', note: 'The polite way to ask a guest what they would like.' },
                { gurmukhi: 'ਉਹ ਸਾਨੂੰ ਦੱਸੇਗੀ', roman: 'Oh saanu dassegi', english: 'She will tell us' },
                { gurmukhi: 'ਫੇਰ ਮਿਲਾਂਗੇ', roman: 'Fer milange', english: 'We will meet again; see you later' },
            ],
        },
        {
            heading: 'Let’s',
            body: [
                'For “let’s”, add -iye to the stem: ਚਲੀਏ (chaliye), let’s go; ਬੈਠੀਏ (baithiye), let’s sit. For a friendly push, start with ਚਲੋ (chalo), come on.',
            ],
            examples: [
                { gurmukhi: 'ਚਲੋ, ਚਲੀਏ', roman: 'Chalo, chaliye', english: 'Come on, let’s go' },
                { gurmukhi: 'ਬੈਠੀਏ?', roman: 'Baithiye?', english: 'Shall we sit?' },
                { gurmukhi: 'ਅਸੀਂ ਸ਼ਾਮ ਨੂੰ ਗੁਰਦੁਆਰੇ ਜਾਵਾਂਗੇ', roman: 'Asi shaam nu Gurdware javange', english: 'We will go to the Gurdwara in the evening' },
            ],
        },
    ],
    quiz: [
        {
            kind: 'choice',
            prompt: 'A woman says “I will go”: Main ___',
            choices: ['javangi', 'javanga', 'javange'],
            choicesLang: 'pa-Latn',
            answer: 'javangi',
        },
        {
            kind: 'choice',
            prompt: 'He will go: Oh ___',
            choices: ['javega', 'javegi', 'jange'],
            choicesLang: 'pa-Latn',
            answer: 'javega',
        },
        {
            kind: 'choice',
            prompt: 'We will meet again: Fer ___',
            choices: ['milange', 'milanga', 'milega'],
            choicesLang: 'pa-Latn',
            answer: 'milange',
        },
        {
            kind: 'choice',
            prompt: 'ਕੱਲ੍ਹ (kal) means…',
            choices: ['Yesterday or tomorrow: the tense decides', 'Only tomorrow', 'Only yesterday'],
            answer: 'Yesterday or tomorrow: the tense decides',
        },
        {
            kind: 'typed',
            prompt: 'Ask a guest, politely, “What will you eat?”',
            answer: 'Tusi ki khaoge?',
        },
        {
            kind: 'typed',
            prompt: 'Say “Come on, let’s go.”',
            answer: 'Chalo, chaliye',
        },
    ],
};

export default lesson;
