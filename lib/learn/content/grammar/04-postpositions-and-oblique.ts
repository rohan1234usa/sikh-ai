// Grammar track, lesson 4: postpositions, the oblique form of nouns, and
// pronouns before a postposition. Types: lib/learn/config.ts.
//
// AI-drafted, pending review by a fluent speaker. Spellings follow the
// phrasebook, then the romanized interface for frequent words (baare,
// saade, saanu, unhan), then the house rules (see grammar lesson 1's
// header). English loanwords keep their English spelling (car, phone,
// California), as the house rules say.
//
// Open questions for that review:
// - "Punjabi has no verb for to have" (mere kol car hai): fair as a
//   simplification?
// - Oh mere ton vadda hai, "he is older than me", with mere ton rather than
//   maithon.

import type { LessonBody } from '../../config';

const lesson: LessonBody = {
    sections: [
        {
            heading: 'Prepositions that come after',
            body: [
                'English says “in the room”. Punjabi says “room in”: ਕਮਰੇ ਵਿੱਚ (kamre vich). The small words English puts before a noun, Punjabi puts after it, so they are called postpositions.',
            ],
            examples: [
                { gurmukhi: 'ਨੂੰ', roman: 'nu', english: 'to; also marks who something is done to' },
                { gurmukhi: 'ਤੋਂ', roman: 'ton', english: 'from; than' },
                { gurmukhi: 'ਵਿੱਚ', roman: 'vich', english: 'in' },
                { gurmukhi: 'ਤੇ', roman: 'te', english: 'on; also, in speech, and' },
                { gurmukhi: 'ਨਾਲ', roman: 'naal', english: 'with' },
                { gurmukhi: 'ਲਈ', roman: 'layi', english: 'for' },
                { gurmukhi: 'ਕੋਲ', roman: 'kol', english: 'near; with (someone), as in having' },
                { gurmukhi: 'ਬਾਰੇ', roman: 'baare', english: 'about' },
            ],
        },
        {
            heading: 'The noun changes shape first',
            body: [
                'Before a postposition, a masculine noun ending in -a changes its -a to -e: ਕਮਰਾ becomes ਕਮਰੇ ਵਿੱਚ, and ਮੁੰਡਾ becomes ਮੁੰਡੇ ਨੂੰ. Grammar books call this the oblique form. Other singular nouns stay as they are: ਘਰ ਵਿੱਚ, ਕੁੜੀ ਨੂੰ.',
                'In the plural, the ending becomes -ian or -an: ਮੁੰਡਿਆਂ ਨੂੰ, to the boys; ਦੋਸਤਾਂ ਨਾਲ, with friends.',
            ],
            examples: [
                { gurmukhi: 'ਕਮਰੇ ਵਿੱਚ', roman: 'kamre vich', english: 'in the room' },
                { gurmukhi: 'ਮੁੰਡੇ ਨੂੰ', roman: 'munde nu', english: 'to the boy' },
                { gurmukhi: 'ਘਰ ਵਿੱਚ', roman: 'ghar vich', english: 'in the house' },
                { gurmukhi: 'ਕੁੜੀ ਨਾਲ', roman: 'kurhi naal', english: 'with the girl' },
                { gurmukhi: 'ਮੁੰਡਿਆਂ ਨੂੰ', roman: 'mundian nu', english: 'to the boys' },
                { gurmukhi: 'ਦੋਸਤਾਂ ਨਾਲ', roman: 'dostan naal', english: 'with friends' },
            ],
        },
        {
            heading: 'Pronouns before a postposition',
            body: [
                'Pronouns change too. With ਨੂੰ, some join into one word: ਮੈਨੂੰ (mainu, to me), ਤੈਨੂੰ (tainu, to you, to a friend), ਤੁਹਾਨੂੰ (tuhanu, to you), ਸਾਨੂੰ (saanu, to us). He, she and they become ਉਸ and ਉਹਨਾਂ: ਉਸ ਨੂੰ, ਉਹਨਾਂ ਨਾਲ.',
                'With ਨਾਲ and ਕੋਲ, I, you and we take their possessive form: ਮੇਰੇ ਨਾਲ, with me; ਸਾਡੇ ਕੋਲ, with us.',
            ],
            examples: [
                { gurmukhi: 'ਮੈਨੂੰ ਦੱਸੋ', roman: 'Mainu dasso', english: 'Tell me' },
                { gurmukhi: 'ਤੁਹਾਨੂੰ ਪਤਾ ਹੈ?', roman: 'Tuhanu pata hai?', english: 'Do you know?' },
                { gurmukhi: 'ਸਾਡੇ ਨਾਲ ਚਲੋ', roman: 'Saade naal chalo', english: 'Come with us' },
                { gurmukhi: 'ਉਸ ਨੂੰ ਫ਼ੋਨ ਕਰੋ', roman: 'Us nu phone karo', english: 'Call him (or her)' },
                { gurmukhi: 'ਮੇਰੇ ਕੋਲ ਕਾਰ ਹੈ', roman: 'Mere kol car hai', english: 'I have a car', note: 'Literally “near me is a car”. Punjabi says “have” this way.' },
            ],
        },
        {
            heading: 'From: ton',
            body: [
                'ਤੋਂ (ton) means from, and also than. A few words join with it: ਘਰੋਂ (gharon, from home), ਕਿੱਥੋਂ (kithon, from where).',
            ],
            examples: [
                { gurmukhi: 'ਤੁਸੀਂ ਕਿੱਥੋਂ ਹੋ?', roman: 'Tusi kithon ho?', english: 'Where are you from?' },
                { gurmukhi: 'ਮੈਂ ਕੈਲੀਫ਼ੋਰਨੀਆ ਤੋਂ ਹਾਂ', roman: 'Main California ton haan', english: 'I am from California' },
                { gurmukhi: 'ਉਹ ਮੇਰੇ ਤੋਂ ਵੱਡਾ ਹੈ', roman: 'Oh mere ton vadda hai', english: 'He is older than me' },
            ],
        },
    ],
    quiz: [
        {
            kind: 'choice',
            prompt: 'Where does ਵਿੱਚ (vich, in) go?',
            choices: ['After the noun', 'Before the noun'],
            answer: 'After the noun',
        },
        {
            kind: 'choice',
            prompt: 'In the room: ___ vich',
            choices: ['kamre', 'kamra', 'kamrian'],
            choicesLang: 'pa-Latn',
            answer: 'kamre',
        },
        {
            kind: 'choice',
            prompt: 'To me',
            choices: ['mainu', 'main nu', 'mera nu'],
            choicesLang: 'pa-Latn',
            answer: 'mainu',
        },
        {
            kind: 'choice',
            prompt: 'With us: ___ naal',
            choices: ['saade', 'saanu', 'asi'],
            choicesLang: 'pa-Latn',
            answer: 'saade',
        },
        {
            kind: 'choice',
            prompt: 'Mere kol car hai means…',
            choices: ['I have a car', 'My car is nearby', 'I am in the car'],
            answer: 'I have a car',
        },
        {
            kind: 'typed',
            prompt: 'Ask “Where are you from?” respectfully.',
            answer: 'Tusi kithon ho?',
        },
        {
            kind: 'typed',
            prompt: 'Say “in the house”.',
            answer: 'ghar vich',
        },
    ],
};

export default lesson;
