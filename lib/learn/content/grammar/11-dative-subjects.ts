// Grammar track, lesson 11: things that happen to you, with mainu: hunger,
// liking, knowing, needing, and "have to". Types: lib/learn/config.ts.
//
// AI-drafted, pending review by a fluent speaker. Spellings follow the
// phrasebook (Mainu bhukh lagi hai keeps its "lagi", an open question there;
// the lessons write the whole verb that way: lag, lagi, lagda), then the
// romanized interface (saanu, and pyar-style pya- for ਪਿਆ-: pyaas), then
// the house rules (see grammar lesson 1's header).
//
// Open questions for that review:
// - ਪਿਆਸ as pyaas, where the house rule would give piaas.
// - Mainu thandh lag rahi hai for "I'm cold".

import type { LessonBody } from '../../config';

const lesson: LessonBody = {
    sections: [
        {
            heading: 'Things that happen to you',
            body: [
                'In English you are hungry. In Punjabi, hunger happens to you: ਮੈਨੂੰ ਭੁੱਖ ਲੱਗੀ ਹੈ, “to me hunger has attached”. The person takes ਨੂੰ (mainu, tuhanu, us nu), and the feeling is the subject.',
                'So the verb agrees with the feeling, not with you: ਭੁੱਖ (hunger) is feminine, so ਲੱਗੀ; ਡਰ (fear) is masculine, so ਲੱਗਦਾ. A man and a woman say exactly the same thing.',
            ],
            examples: [
                { gurmukhi: 'ਮੈਨੂੰ ਭੁੱਖ ਲੱਗੀ ਹੈ', roman: 'Mainu bhukh lagi hai', english: 'I am hungry' },
                { gurmukhi: 'ਮੈਨੂੰ ਪਿਆਸ ਲੱਗੀ ਹੈ', roman: 'Mainu pyaas lagi hai', english: 'I am thirsty' },
                { gurmukhi: 'ਮੈਨੂੰ ਡਰ ਲੱਗਦਾ ਹੈ', roman: 'Mainu dar lagda hai', english: 'I am scared' },
                { gurmukhi: 'ਮੈਨੂੰ ਠੰਢ ਲੱਗ ਰਹੀ ਹੈ', roman: 'Mainu thandh lag rahi hai', english: 'I am cold' },
                { gurmukhi: 'ਮੈਨੂੰ ਨੀਂਦ ਆ ਰਹੀ ਹੈ', roman: 'Mainu neend aa rahi hai', english: 'I am sleepy', note: 'Literally “sleep is coming to me”.' },
            ],
        },
        {
            heading: 'Liking, knowing, needing',
            body: [
                'Liking, knowing and needing work the same way. A language, or any skill, “comes to” you.',
            ],
            examples: [
                { gurmukhi: 'ਮੈਨੂੰ ਚਾਹ ਪਸੰਦ ਹੈ', roman: 'Mainu chaa pasand hai', english: 'I like tea' },
                { gurmukhi: 'ਮੈਨੂੰ ਪਤਾ ਹੈ', roman: 'Mainu pata hai', english: 'I know' },
                { gurmukhi: 'ਤੁਹਾਨੂੰ ਕੀ ਚਾਹੀਦਾ ਹੈ?', roman: 'Tuhanu ki chahida hai?', english: 'What do you need?' },
                { gurmukhi: 'ਮੈਨੂੰ ਪਾਣੀ ਚਾਹੀਦਾ ਹੈ', roman: 'Mainu pani chahida hai', english: 'I need water' },
                { gurmukhi: 'ਮੈਨੂੰ ਥੋੜ੍ਹੀ ਪੰਜਾਬੀ ਆਉਂਦੀ ਹੈ', roman: 'Mainu thorhi Punjabi aundi hai', english: 'I know a little Punjabi', note: 'Literally “a little Punjabi comes to me”.' },
                { gurmukhi: 'ਮੈਨੂੰ ਸਮਝ ਨਹੀਂ ਆਈ', roman: 'Mainu samajh nahi aayi', english: 'I didn’t understand' },
                { gurmukhi: 'ਮੈਨੂੰ ਲੱਗਦਾ ਹੈ ਕਿ ਮੀਂਹ ਪਵੇਗਾ', roman: 'Mainu lagda hai ki meenh pavega', english: 'I think it will rain', note: 'Mainu lagda hai, “it seems to me”, is the everyday “I think”.' },
            ],
        },
        {
            heading: 'Have to',
            body: [
                'Having to do something works the same way, with the -na form and ਪੈਣਾ (paina): ਮੈਨੂੰ ਜਾਣਾ ਪਵੇਗਾ, I will have to go; ਮੈਨੂੰ ਜਾਣਾ ਪਿਆ, I had to go.',
            ],
            examples: [
                { gurmukhi: 'ਮੈਨੂੰ ਜਾਣਾ ਪਵੇਗਾ', roman: 'Mainu jana pavega', english: 'I will have to go' },
                { gurmukhi: 'ਮੈਨੂੰ ਜਾਣਾ ਪਿਆ', roman: 'Mainu jana pia', english: 'I had to go' },
                { gurmukhi: 'ਸਾਨੂੰ ਉਡੀਕ ਕਰਨੀ ਪਈ', roman: 'Saanu udeek karni payi', english: 'We had to wait', note: 'ਉਡੀਕ (waiting) is feminine, so karni payi.' },
            ],
            tip: 'Whenever English says “I” and Punjabi says ਮੈਨੂੰ, the verb matches the thing, not you.',
        },
    ],
    quiz: [
        {
            kind: 'choice',
            prompt: 'I am hungry',
            choices: ['Mainu bhukh lagi hai', 'Main bhukh haan', 'Mainu bhukh lagda hai'],
            choicesLang: 'pa-Latn',
            answer: 'Mainu bhukh lagi hai',
        },
        {
            kind: 'choice',
            prompt: 'I am scared: Mainu dar ___ hai',
            choices: ['lagda', 'lagi', 'lagde'],
            choicesLang: 'pa-Latn',
            answer: 'lagda',
            explanation: 'ਡਰ (fear) is masculine.',
        },
        {
            kind: 'choice',
            prompt: 'Mainu pani chahida hai means…',
            choices: ['I need water', 'I drank water', 'I have water'],
            answer: 'I need water',
        },
        {
            kind: 'choice',
            prompt: 'I will have to go: Mainu jana ___',
            choices: ['pavega', 'pia', 'chahida'],
            choicesLang: 'pa-Latn',
            answer: 'pavega',
        },
        {
            kind: 'typed',
            prompt: 'Say “I know.”',
            answer: 'Mainu pata hai',
        },
        {
            kind: 'typed',
            prompt: 'Ask “What do you need?” respectfully.',
            answer: 'Tuhanu ki chahida hai?',
        },
        {
            kind: 'typed',
            prompt: 'Say “I didn’t understand.”',
            answer: 'Mainu samajh nahi aayi',
            accept: ['Mainu samajh nahin aayi'],
        },
    ],
};

export default lesson;
