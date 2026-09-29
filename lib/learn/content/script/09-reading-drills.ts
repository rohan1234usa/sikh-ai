// Script track, lesson 9: reading practice on words a Punjabi American
// already hears at the Gurdwara and at home, then short sentences. Types:
// lib/learn/config.ts.
//
// AI-drafted, pending review by a fluent speaker. Many of these words and
// sentences also appear in the translator's phrasebook
// (lib/translate/phrasebook.ts) and are spelled the same way, which
// tests/learn/content.test.ts checks. Romanization follows the house style
// (ROMANIZATION in lib/translate/prompts.ts).
//
// Open questions for that review:
// - Typed answers accept a few common alternatives (gurudwara, jora ghar).
//   Should any of them not count?

import type { LessonBody } from '../../config';

const lesson: LessonBody = {
    sections: [
        {
            heading: 'At the Gurdwara',
            body: [
                'Every word below uses letters and marks from the earlier lessons. Read the Gurmukhi first, out loud if you can, then check the line under it.',
            ],
            examples: [
                { gurmukhi: 'ਵਾਹਿਗੁਰੂ', roman: 'Waheguru', english: 'Waheguru, the Wondrous Guru: God' },
                { gurmukhi: 'ਗੁਰਦੁਆਰਾ', roman: 'Gurdwara', english: 'Gurdwara, the Guru’s door' },
                { gurmukhi: 'ਲੰਗਰ', roman: 'langar', english: 'langar, the free community kitchen and meal' },
                { gurmukhi: 'ਸੇਵਾ', roman: 'seva', english: 'seva, selfless service' },
                { gurmukhi: 'ਸੰਗਤ', roman: 'Sangat', english: 'the congregation' },
                { gurmukhi: 'ਜੋੜਾ ਘਰ', roman: 'jorha ghar', english: 'the shoe room' },
                { gurmukhi: 'ੴ', roman: 'Ik Onkar', english: 'One Creator, the opening of the Mool Mantar', note: 'A single symbol: the digit ੧ joined to the letter ੳ with a long stroke.' },
            ],
        },
        {
            heading: 'At home',
            body: [
                'The kitchen and the family, in Gurmukhi. Most of these you have heard all your life.',
            ],
            examples: [
                { gurmukhi: 'ਰੋਟੀ', roman: 'roti', english: 'roti, flatbread; a meal' },
                { gurmukhi: 'ਦਾਲ', roman: 'daal', english: 'lentils' },
                { gurmukhi: 'ਸਬਜ਼ੀ', roman: 'sabzi', english: 'vegetables; a vegetable dish' },
                { gurmukhi: 'ਮੰਮੀ', roman: 'mummy', english: 'mom' },
                { gurmukhi: 'ਪਾਪਾ', roman: 'papa', english: 'dad' },
                { gurmukhi: 'ਨਾਨੀ', roman: 'nani', english: 'grandmother, your mother’s mother' },
            ],
        },
        {
            heading: 'Short sentences',
            body: [
                'Now whole sentences. Punjabi puts the verb last, so read to the end before you guess the meaning. Lesson 1 of the grammar track explains why.',
            ],
            examples: [
                { gurmukhi: 'ਸਤਿ ਸ੍ਰੀ ਅਕਾਲ ਜੀ', roman: 'Sat Sri Akal ji', english: 'Hello (respectfully)' },
                { gurmukhi: 'ਕੀ ਹਾਲ ਹੈ?', roman: 'Ki haal hai?', english: 'How are you?' },
                { gurmukhi: 'ਮੈਂ ਠੀਕ ਹਾਂ', roman: 'Main theek haan', english: 'I am fine' },
                { gurmukhi: 'ਰੋਟੀ ਖਾ ਲਵੋ', roman: 'Roti kha lavo', english: 'Come and eat (politely)' },
                { gurmukhi: 'ਮੈਨੂੰ ਥੋੜ੍ਹੀ ਪੰਜਾਬੀ ਆਉਂਦੀ ਹੈ', roman: 'Mainu thorhi Punjabi aundi hai', english: 'I know a little Punjabi' },
                { gurmukhi: 'ਅੱਜ ਗੁਰਦੁਆਰੇ ਚਲੀਏ?', roman: 'Ajj Gurdware chaliye?', english: 'Shall we go to the Gurdwara today?' },
            ],
        },
    ],
    quiz: [
        {
            kind: 'typed',
            prompt: 'Read this word.',
            promptPa: 'ਲੰਗਰ',
            answer: 'langar',
        },
        {
            kind: 'typed',
            prompt: 'Read this word.',
            promptPa: 'ਸੇਵਾ',
            answer: 'seva',
        },
        {
            kind: 'typed',
            prompt: 'Read this word.',
            promptPa: 'ਗੁਰਦੁਆਰਾ',
            answer: 'Gurdwara',
            accept: ['gurudwara', 'gurduara'],
        },
        {
            kind: 'typed',
            prompt: 'Read this word.',
            promptPa: 'ਵਾਹਿਗੁਰੂ',
            answer: 'Waheguru',
        },
        {
            kind: 'typed',
            prompt: 'Read these two words. They name a room at the Gurdwara.',
            promptPa: 'ਜੋੜਾ ਘਰ',
            answer: 'jorha ghar',
            accept: ['jora ghar', 'joda ghar'],
        },
        {
            kind: 'typed',
            prompt: 'Read this question.',
            promptPa: 'ਕੀ ਹਾਲ ਹੈ?',
            answer: 'Ki haal hai?',
        },
        {
            kind: 'typed',
            prompt: 'Read this sentence.',
            promptPa: 'ਮੈਂ ਠੀਕ ਹਾਂ',
            answer: 'Main theek haan',
        },
        {
            kind: 'typed',
            prompt: 'Read this sentence.',
            promptPa: 'ਰੋਟੀ ਖਾ ਲਵੋ',
            answer: 'Roti kha lavo',
        },
    ],
};

export default lesson;
