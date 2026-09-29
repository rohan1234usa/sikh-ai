// Grammar track, lesson 8: commands and requests at three levels of
// politeness, softening helper verbs, and "don't". Types: lib/learn/config.ts.
//
// AI-drafted, pending review by a fluent speaker. Register mistakes are the
// ones people notice, so the tu and tusi forms need a careful check.
// Spellings follow the phrasebook (its Sir dhak lavo ji keeps "dhak"), then
// the romanized interface, then the house rules (see grammar lesson 1's
// header). A word starting with the vowel letter ਆ before another vowel is
// written aa (aao, aaya, aayi), as in the phrasebook.
//
// Open questions for that review:
// - "The -na form sounds like a request for later" (phone karna ji).
// - Raula na pao for "don't make noise".

import type { LessonBody } from '../../config';

const lesson: LessonBody = {
    sections: [
        {
            heading: 'Three levels of asking',
            body: [
                'Punjabi commands come in levels of politeness, and picking the level is part of the meaning.',
                'To a close friend, a younger sibling or a child, use the bare stem: ਕਰ (kar), ਆ (aa), ਬੈਠ (baith). To anyone else, add -o: ਕਰੋ (karo), ਆਓ (aao), ਬੈਠੋ (baitho). Gentler still, add ਜੀ (ji), or use the -na form, which sounds like a request for later: ਫ਼ੋਨ ਕਰਨਾ ਜੀ, please do call.',
            ],
            examples: [
                { gurmukhi: 'ਇੱਥੇ ਆ', roman: 'Ithe aa', english: 'Come here (to a child or a close friend)' },
                { gurmukhi: 'ਇੱਥੇ ਆਓ', roman: 'Ithe aao', english: 'Come here (to anyone else)' },
                { gurmukhi: 'ਬੈਠੋ ਜੀ', roman: 'Baitho ji', english: 'Please sit' },
                { gurmukhi: 'ਹੌਲੀ ਹੌਲੀ ਬੋਲੋ ਜੀ', roman: 'Hauli hauli bolo ji', english: 'Please speak slowly' },
                { gurmukhi: 'ਮਾਫ਼ ਕਰਨਾ ਜੀ', roman: 'Maaf karna ji', english: 'Excuse me; I am sorry' },
                { gurmukhi: 'ਫ਼ੋਨ ਕਰਨਾ ਜੀ', roman: 'Phone karna ji', english: 'Please do call' },
            ],
        },
        {
            heading: 'Softening with a helper verb',
            body: [
                'A command sounds warmer with a helper verb after it. ਲਵੋ (lavo, take) means “for yourself”: ਖਾ ਲਵੋ, go ahead and eat. ਦਿਓ (deo, give) means “for someone else”: ਦੱਸ ਦਿਓ, tell me. You will hear both at every Punjabi table.',
            ],
            examples: [
                { gurmukhi: 'ਰੋਟੀ ਖਾ ਲਵੋ', roman: 'Roti kha lavo', english: 'Come and eat (politely)' },
                { gurmukhi: 'ਹੋਰ ਲਵੋ ਜੀ', roman: 'Hor lavo ji', english: 'Have some more' },
                { gurmukhi: 'ਮੈਨੂੰ ਦੱਸ ਦਿਓ', roman: 'Mainu dass deo', english: 'Let me know' },
                { gurmukhi: 'ਜੋੜੇ ਇੱਥੇ ਲਾਹ ਦਿਓ ਜੀ', roman: 'Jorhe ithe laah deo ji', english: 'Take your shoes off here' },
                { gurmukhi: 'ਸਿਰ ਢੱਕ ਲਵੋ ਜੀ', roman: 'Sir dhak lavo ji', english: 'Please cover your head' },
            ],
        },
        {
            heading: 'Don’t: na',
            body: [
                'For don’t, put ਨਾ (na) before the command, and keep its level: ਨਾ ਕਰ to a friend, ਨਾ ਕਰੋ to anyone else.',
            ],
            examples: [
                { gurmukhi: 'ਫ਼ਿਕਰ ਨਾ ਕਰੋ', roman: 'Fikar na karo', english: 'Don’t worry' },
                { gurmukhi: 'ਰੌਲਾ ਨਾ ਪਾਓ', roman: 'Raula na pao', english: 'Don’t make noise' },
                { gurmukhi: 'ਇਹ ਨਾ ਖਾ', roman: 'Ih na kha', english: 'Don’t eat this (to a child)' },
            ],
            tip: 'When unsure, go up a level. Nobody minds being asked too politely.',
        },
    ],
    quiz: [
        {
            kind: 'choice',
            prompt: 'To an elder: “Please sit.”',
            choices: ['Baitho ji', 'Baith', 'Baith ja'],
            choicesLang: 'pa-Latn',
            answer: 'Baitho ji',
        },
        {
            kind: 'choice',
            prompt: 'Which is the casual “Come here”, for a little cousin?',
            choices: ['Ithe aa', 'Ithe aao ji'],
            choicesLang: 'pa-Latn',
            answer: 'Ithe aa',
        },
        {
            kind: 'choice',
            prompt: 'What does lavo add in Roti kha lavo?',
            choices: ['Warmth: go ahead, for yourself', 'The past tense', 'A question'],
            answer: 'Warmth: go ahead, for yourself',
        },
        {
            kind: 'choice',
            prompt: 'Don’t do it (to a friend)',
            choices: ['Na kar', 'Na karo ji', 'Kar na'],
            choicesLang: 'pa-Latn',
            answer: 'Na kar',
        },
        {
            kind: 'typed',
            prompt: 'Say “Don’t worry” politely.',
            answer: 'Fikar na karo',
            accept: ['Fikr na karo', 'Fiker na karo'],
        },
        {
            kind: 'typed',
            prompt: 'Say “Please speak slowly.”',
            answer: 'Hauli hauli bolo ji',
        },
    ],
};

export default lesson;
