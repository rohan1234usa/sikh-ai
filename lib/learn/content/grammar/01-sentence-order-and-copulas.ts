// Grammar track, lesson 1: word order, the pronouns, and "to be". Types:
// lib/learn/config.ts.
//
// AI-drafted, pending review by a fluent speaker. Spellings follow, in order:
// the translator's phrasebook where it has the word (the content test
// enforces it), the romanized interface (lib/i18n/dictionaries/pa-latn.ts)
// for words it uses often (oh, baare, saade, saanu, unhan, kamm), and
// otherwise the house rules (lib/translate/romanization.ts).
//
// Open questions for that review:
// - ਉਹ is written "oh", as the interface writes it; the house rules have no
//   example for it.
// - The tip says spoken Punjabi often uses ne for han. Worth keeping?
// - ਸੀ is taught as the all-purpose "was"; ਸਾਂ and ਸਨ are only mentioned.

import type { LessonBody } from '../../config';

const lesson: LessonBody = {
    sections: [
        {
            heading: 'The verb comes last',
            body: [
                'English says “I eat roti”. Punjabi says “I roti eating am”: the subject, then the object, then the verb, with the helper verb at the very end.',
                'So a Punjabi sentence often only makes sense at its last word, and a question can look exactly like a statement until the voice rises.',
            ],
            examples: [
                { gurmukhi: 'ਮੈਂ ਰੋਟੀ ਖਾਂਦਾ ਹਾਂ', roman: 'Main roti khanda haan', english: 'I eat roti (a man speaking)', note: 'Word by word: I, roti, eating, am.' },
                { gurmukhi: 'ਉਹ ਪੰਜਾਬੀ ਬੋਲਦੀ ਹੈ', roman: 'Oh Punjabi boldi hai', english: 'She speaks Punjabi' },
                { gurmukhi: 'ਅਸੀਂ ਘਰ ਜਾਂਦੇ ਹਾਂ', roman: 'Asi ghar jande haan', english: 'We go home' },
            ],
        },
        {
            heading: 'The pronouns',
            body: [
                'Punjabi has two words for “you”. ਤੂੰ (tu) is for a close friend, a child, and Waheguru in prayer. ਤੁਸੀਂ (tusi) is for anyone you respect, and for more than one person. When in doubt, say tusi; lesson 10 covers respect in full.',
                'ਉਹ (oh) means he, she, they and that, and ਇਹ (ih) means this. The pronoun doesn’t say he or she; the verb does, as lesson 2 shows.',
            ],
            examples: [
                { gurmukhi: 'ਮੈਂ', roman: 'main', english: 'I' },
                { gurmukhi: 'ਤੂੰ', roman: 'tu', english: 'you, to a close friend or a child' },
                { gurmukhi: 'ਤੁਸੀਂ', roman: 'tusi', english: 'you, respectfully or to more than one' },
                { gurmukhi: 'ਉਹ', roman: 'oh', english: 'he, she, they; that' },
                { gurmukhi: 'ਇਹ', roman: 'ih', english: 'this; he or she, close by' },
                { gurmukhi: 'ਅਸੀਂ', roman: 'asi', english: 'we' },
            ],
        },
        {
            heading: '“To be”: haan, hain, hai, ho, han',
            body: [
                'The verb “to be” changes with the person. It is also the helper that ends most sentences, so it is worth knowing cold: ਮੈਂ ਹਾਂ, ਅਸੀਂ ਹਾਂ, ਤੂੰ ਹੈਂ, ਤੁਸੀਂ ਹੋ, ਉਹ ਹੈ, and ਉਹ ਹਨ for more than one.',
            ],
            examples: [
                { gurmukhi: 'ਮੈਂ ਠੀਕ ਹਾਂ', roman: 'Main theek haan', english: 'I am fine' },
                { gurmukhi: 'ਅਸੀਂ ਘਰ ਹਾਂ', roman: 'Asi ghar haan', english: 'We are at home' },
                { gurmukhi: 'ਤੂੰ ਕਿੱਥੇ ਹੈਂ?', roman: 'Tu kithe hain?', english: 'Where are you? (to a friend)' },
                { gurmukhi: 'ਤੁਸੀਂ ਕਿੱਥੇ ਹੋ?', roman: 'Tusi kithe ho?', english: 'Where are you? (respectfully)' },
                { gurmukhi: 'ਉਹ ਮੇਰਾ ਭਰਾ ਹੈ', roman: 'Oh mera bhra hai', english: 'He is my brother' },
                { gurmukhi: 'ਉਹ ਮੇਰੇ ਦੋਸਤ ਹਨ', roman: 'Oh mere dost han', english: 'They are my friends' },
                { gurmukhi: 'ਇਹ ਕੀ ਹੈ?', roman: 'Ih ki hai?', english: 'What is this?' },
            ],
            tip: 'In speech you will often hear ne for han: oh mere dost ne. It is the same word, not the ne of lesson 6.',
        },
        {
            heading: 'Was: si',
            body: [
                'For the past, one word does most of the work: ਸੀ (si), for I, you, he, she and we alike. Careful speakers say ਸਨ (san) for they, but si is always understood.',
            ],
            examples: [
                { gurmukhi: 'ਮੈਂ ਘਰ ਸੀ', roman: 'Main ghar si', english: 'I was at home' },
                { gurmukhi: 'ਕੀਰਤਨ ਬਹੁਤ ਸੋਹਣਾ ਸੀ', roman: 'Kirtan bahut sohna si', english: 'The kirtan was beautiful' },
            ],
        },
    ],
    quiz: [
        {
            kind: 'choice',
            prompt: 'Where does the verb go in a Punjabi sentence?',
            choices: ['At the end', 'At the start', 'Right after the subject'],
            answer: 'At the end',
        },
        {
            kind: 'choice',
            prompt: 'I am fine: Main theek ___',
            choices: ['haan', 'hai', 'ho'],
            choicesLang: 'pa-Latn',
            answer: 'haan',
        },
        {
            kind: 'choice',
            prompt: 'Where are you? (respectfully) Tusi kithe ___?',
            choices: ['ho', 'hai', 'haan'],
            choicesLang: 'pa-Latn',
            answer: 'ho',
        },
        {
            kind: 'choice',
            prompt: 'Which “you” is safe with anyone you don’t know well?',
            choices: ['tusi', 'tu'],
            choicesLang: 'pa-Latn',
            answer: 'tusi',
        },
        {
            kind: 'choice',
            prompt: 'What can ਉਹ (oh) mean?',
            choices: ['He, she, they or that', 'Only he', 'This'],
            answer: 'He, she, they or that',
        },
        {
            kind: 'typed',
            prompt: 'Say “I am fine.”',
            answer: 'Main theek haan',
            // Strict, so han (they are) isn't taken for haan (I am).
            accept: ['Main thik haan'],
            strict: true,
            explanation: 'Main takes haan, with the long aa; han is for more than one person, or respect.',
        },
        {
            kind: 'typed',
            prompt: 'Finish the sentence: “The kirtan was beautiful.” Kirtan bahut sohna …',
            answer: 'si',
        },
    ],
};

export default lesson;
