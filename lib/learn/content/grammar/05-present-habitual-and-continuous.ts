// Grammar track, lesson 5: the present, habitual (main karda haan) and
// continuous (main kar riha haan), and its negative. Types:
// lib/learn/config.ts.
//
// AI-drafted, pending review by a fluent speaker. Spellings follow the
// phrasebook, then the romanized interface for frequent words (kamm), then
// the house rules (see grammar lesson 1's header).
//
// Open questions for that review:
// - Mummy khana bana rahe han: the plural of respect for a woman, with the
//   -e form. Common enough to teach this early?
// - "In the habitual negative the final hai/haan is usually dropped."

import type { LessonBody } from '../../config';

const lesson: LessonBody = {
    sections: [
        {
            heading: 'What you usually do',
            body: [
                'For something you do regularly, take the verb’s stem, add -da, -di, -de or -dian to match the subject, and end with “to be”: ਮੈਂ ਕੰਮ ਕਰਦਾ ਹਾਂ (main kamm karda haan), I work.',
                'The stem is the verb without its -na: ਕਰਨਾ (karna, to do) gives kar-, and ਬੋਲਣਾ (bolna, to speak) gives bol-. After a vowel the ending picks up an n: ਜਾਣਾ (jana, to go) gives ਜਾਂਦਾ (janda), and ਖਾਣਾ (khana, to eat) gives ਖਾਂਦਾ (khanda).',
            ],
            examples: [
                { gurmukhi: 'ਮੈਂ ਕੰਮ ਕਰਦਾ ਹਾਂ', roman: 'Main kamm karda haan', english: 'I work (a man speaking)' },
                { gurmukhi: 'ਮੈਂ ਕੰਮ ਕਰਦੀ ਹਾਂ', roman: 'Main kamm kardi haan', english: 'I work (a woman speaking)' },
                { gurmukhi: 'ਉਹ ਪੰਜਾਬੀ ਬੋਲਦੇ ਹਨ', roman: 'Oh Punjabi bolde han', english: 'They speak Punjabi' },
                { gurmukhi: 'ਅਸੀਂ ਹਰ ਐਤਵਾਰ ਗੁਰਦੁਆਰੇ ਜਾਂਦੇ ਹਾਂ', roman: 'Asi har aitvaar Gurdware jande haan', english: 'We go to the Gurdwara every Sunday' },
                { gurmukhi: 'ਤੁਸੀਂ ਕੀ ਕਰਦੇ ਹੋ?', roman: 'Tusi ki karde ho?', english: 'What do you do?', note: 'Also the usual way to ask about someone’s job.' },
            ],
        },
        {
            heading: 'What you are doing now',
            body: [
                'For something happening right now, use the stem, then ਰਿਹਾ, ਰਹੀ, ਰਹੇ or ਰਹੀਆਂ (riha, rahi, rahe, rahian) to match the subject, then “to be”.',
            ],
            examples: [
                { gurmukhi: 'ਮੈਂ ਰੋਟੀ ਖਾ ਰਿਹਾ ਹਾਂ', roman: 'Main roti kha riha haan', english: 'I am eating (a man speaking)' },
                { gurmukhi: 'ਤੁਸੀਂ ਕੀ ਕਰ ਰਹੇ ਹੋ?', roman: 'Tusi ki kar rahe ho?', english: 'What are you doing?' },
                { gurmukhi: 'ਮੰਮੀ ਖਾਣਾ ਬਣਾ ਰਹੇ ਹਨ', roman: 'Mummy khana bana rahe han', english: 'Mom is cooking', note: 'Rahe han, the plural, out of respect.' },
                { gurmukhi: 'ਅਰਦਾਸ ਹੋ ਰਹੀ ਹੈ', roman: 'Ardaas ho rahi hai', english: 'The ardaas is being offered' },
                { gurmukhi: 'ਮੀਂਹ ਪੈ ਰਿਹਾ ਹੈ', roman: 'Meenh pai riha hai', english: 'It is raining' },
            ],
        },
        {
            heading: 'Saying you don’t',
            body: [
                'Put ਨਹੀਂ (nahi) before the verb. In the usual-present, the “to be” at the end is normally dropped: ਮੈਂ ਮੀਟ ਨਹੀਂ ਖਾਂਦਾ (main meat nahi khanda), I don’t eat meat.',
            ],
            examples: [
                { gurmukhi: 'ਮੈਂ ਮੀਟ ਨਹੀਂ ਖਾਂਦਾ', roman: 'Main meat nahi khanda', english: 'I don’t eat meat (a man speaking)' },
                { gurmukhi: 'ਉਹ ਪੰਜਾਬੀ ਨਹੀਂ ਬੋਲਦੀ', roman: 'Oh Punjabi nahi boldi', english: 'She doesn’t speak Punjabi' },
                { gurmukhi: 'ਮੈਨੂੰ ਨਹੀਂ ਪਤਾ', roman: 'Mainu nahi pata', english: 'I don’t know' },
            ],
            tip: 'Hear yourself in these. A woman says kardi, rahi and khandi; a man says karda, riha and khanda.',
        },
    ],
    quiz: [
        {
            kind: 'choice',
            prompt: 'A woman says “I work”: Main kamm ___ haan',
            choices: ['kardi', 'karda', 'karde'],
            choicesLang: 'pa-Latn',
            answer: 'kardi',
        },
        {
            kind: 'choice',
            prompt: 'What are you doing? Tusi ki kar ___ ho?',
            choices: ['rahe', 'riha', 'rahi'],
            choicesLang: 'pa-Latn',
            answer: 'rahe',
        },
        {
            kind: 'choice',
            prompt: 'Main roti kha riha haan means…',
            choices: ['I am eating', 'I eat every day', 'I ate'],
            answer: 'I am eating',
        },
        {
            kind: 'choice',
            prompt: 'A man says “I go”: Main ___ haan',
            choices: ['janda', 'jana', 'javanga'],
            choicesLang: 'pa-Latn',
            answer: 'janda',
        },
        {
            kind: 'typed',
            prompt: 'Say “I don’t know.”',
            answer: 'Mainu nahi pata',
            accept: ['Mainu nahin pata', 'Menu nahi pata'],
        },
        {
            kind: 'typed',
            prompt: 'Ask “What do you do?” respectfully.',
            answer: 'Tusi ki karde ho?',
        },
        {
            kind: 'typed',
            prompt: 'Say “It is raining.”',
            answer: 'Meenh pai riha hai',
            accept: ['Meeh pai riha hai'],
        },
    ],
};

export default lesson;
