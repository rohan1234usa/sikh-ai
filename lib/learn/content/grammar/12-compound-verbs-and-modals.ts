// Grammar track, lesson 12: verb pairs (ho gaya, chala gaya, dass deo) and the
// helpers for can, already, having done and should. Types:
// lib/learn/config.ts.
//
// AI-drafted, pending review by a fluent speaker. Spellings follow the
// phrasebook (several sentences here are phrasebook entries), then the
// romanized interface, then the house rules (see grammar lesson 1's
// header): ਚੁੱਕਾ is chukka, ਸਿੱਖਣੀ is sikhni.
//
// Open questions for that review:
// - Mainu Punjabi sikhni chahidi hai: agreement of both verbs with the
//   feminine object.
// - ਆਰਾਮ as araam, the house rule's spelling (aaram is common).

import type { LessonBody } from '../../config';

const lesson: LessonBody = {
    sections: [
        {
            heading: 'Verb pairs',
            body: [
                'Punjabi often pairs a verb’s stem with a second verb that adds a shade of meaning. ਜਾਣਾ (go) adds finishing or changing: ਹੋ ਗਿਆ, it’s done. ਲੈਣਾ (take) adds “for yourself”, and ਦੇਣਾ (give) “for someone else”.',
            ],
            examples: [
                { gurmukhi: 'ਹੋ ਗਿਆ', roman: 'ho gaya', english: 'it’s done; it happened' },
                { gurmukhi: 'ਠੀਕ ਹੋ ਗਿਆ', roman: 'theek ho gaya', english: 'it’s fixed; he got better' },
                { gurmukhi: 'ਉਹ ਚਲਾ ਗਿਆ', roman: 'Oh chala gaya', english: 'He left' },
                { gurmukhi: 'ਉਹ ਆ ਗਏ', roman: 'Oh aa gaye', english: 'They have arrived' },
                { gurmukhi: 'ਮੈਂ ਰੱਜ ਗਿਆ', roman: 'Main rajj gaya', english: 'I am full (a man speaking)' },
                { gurmukhi: 'ਮੈਨੂੰ ਦੱਸ ਦਿਓ', roman: 'Mainu dass deo', english: 'Let me know' },
            ],
        },
        {
            heading: 'Can: sakda',
            body: [
                'For can, put the stem before ਸਕਦਾ (sakda) and its forms: ਮੈਂ ਪੰਜਾਬੀ ਬੋਲ ਸਕਦਾ ਹਾਂ, I can speak Punjabi.',
            ],
            examples: [
                { gurmukhi: 'ਮੈਂ ਪੰਜਾਬੀ ਬੋਲ ਸਕਦੀ ਹਾਂ', roman: 'Main Punjabi bol sakdi haan', english: 'I can speak Punjabi (a woman speaking)' },
                { gurmukhi: 'ਕੀ ਮੈਂ ਸੇਵਾ ਕਰ ਸਕਦਾ ਹਾਂ?', roman: 'Ki main seva kar sakda haan?', english: 'May I help with seva?' },
                { gurmukhi: 'ਪਾਣੀ ਮਿਲ ਸਕਦਾ ਹੈ ਜੀ?', roman: 'Pani mil sakda hai ji?', english: 'Could I get some water?' },
                { gurmukhi: 'ਮੈਂ ਨਹੀਂ ਆ ਸਕਦਾ', roman: 'Main nahi aa sakda', english: 'I can’t come (a man speaking)' },
            ],
        },
        {
            heading: 'Already, having done, should',
            body: [
                'ਚੁੱਕਾ (chukka) after a stem means already: ਮੈਂ ਖਾ ਚੁੱਕਾ ਹਾਂ. ਕੇ (ke) after a stem means “having done”, the everyday way to chain two actions: ਖਾ ਕੇ ਜਾਓ. And the -na form with ਚਾਹੀਦਾ (chahida) means should.',
            ],
            examples: [
                { gurmukhi: 'ਮੈਂ ਖਾ ਚੁੱਕਾ ਹਾਂ', roman: 'Main kha chukka haan', english: 'I have already eaten (a man speaking)' },
                { gurmukhi: 'ਖਾ ਕੇ ਜਾਓ', roman: 'Kha ke jao', english: 'Eat before you go', note: 'Literally “having eaten, go”.' },
                { gurmukhi: 'ਤੁਹਾਨੂੰ ਮਿਲ ਕੇ ਬਹੁਤ ਖ਼ੁਸ਼ੀ ਹੋਈ', roman: 'Tuhanu mil ke bahut khushi hoyi', english: 'Very pleased to meet you' },
                { gurmukhi: 'ਤੁਹਾਨੂੰ ਆਰਾਮ ਕਰਨਾ ਚਾਹੀਦਾ ਹੈ', roman: 'Tuhanu araam karna chahida hai', english: 'You should rest' },
                { gurmukhi: 'ਮੈਨੂੰ ਪੰਜਾਬੀ ਸਿੱਖਣੀ ਚਾਹੀਦੀ ਹੈ', roman: 'Mainu Punjabi sikhni chahidi hai', english: 'I should learn Punjabi', note: 'ਪੰਜਾਬੀ is feminine, so both verbs change: sikhni chahidi.' },
            ],
        },
    ],
    quiz: [
        {
            kind: 'choice',
            prompt: 'Ho gaya means…',
            choices: ['It’s done; it happened', 'Go away', 'It will happen'],
            answer: 'It’s done; it happened',
        },
        {
            kind: 'choice',
            prompt: 'A woman says “I can speak Punjabi”: Main Punjabi bol ___ haan',
            choices: ['sakdi', 'sakda', 'chukki'],
            choicesLang: 'pa-Latn',
            answer: 'sakdi',
        },
        {
            kind: 'choice',
            prompt: 'Kha ke jao means…',
            choices: ['Eat before you go', 'Go and eat', 'Don’t eat'],
            answer: 'Eat before you go',
        },
        {
            kind: 'choice',
            prompt: 'I am full (a man speaking)',
            choices: ['Main rajj gaya', 'Main rajj gayi', 'Mainu rajj gaya'],
            choicesLang: 'pa-Latn',
            answer: 'Main rajj gaya',
        },
        {
            kind: 'typed',
            prompt: 'Say “I can’t come” (a man speaking).',
            answer: 'Main nahi aa sakda',
            accept: ['Main nahin aa sakda'],
        },
        {
            kind: 'typed',
            prompt: 'Say “You should rest,” respectfully.',
            answer: 'Tuhanu araam karna chahida hai',
        },
    ],
};

export default lesson;
