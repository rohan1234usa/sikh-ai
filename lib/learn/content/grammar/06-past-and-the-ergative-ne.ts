// Grammar track, lesson 6: the past tense, object agreement, and ne. This is
// where learners ask "why kita and not kiti?". Types: lib/learn/config.ts.
//
// AI-drafted, pending review by a fluent speaker. This lesson needs a
// careful check: drafts drift toward Hindi forms (khaya for khadha, kiya
// for kita, maine for main). The facts it rests on: intransitive pasts
// agree with the subject; transitive pasts agree with the object; ne marks
// a third-person or noun subject, and first- and second-person pronouns
// don't take it in Punjabi (main roti khadhi). Spellings follow the
// phrasebook, then the romanized interface, then the house rules (see
// grammar lesson 1's header); by those rules ਪੀਤਾ is pita, like ਪਿਤਾ.
//
// Open questions for that review:
// - ਕੱਲ੍ਹ is written kal, as families write it.
// - ਲਿਆ is lia by the house rule (liya and leya are common too).

import type { LessonBody } from '../../config';

const lesson: LessonBody = {
    sections: [
        {
            heading: 'Went, came, sat: the verb follows the person',
            body: [
                'For verbs where nothing is done to anything, like going, coming, sitting and sleeping, the past agrees with the person, just like an adjective: a man says ਮੈਂ ਗਿਆ (main gaya), a woman ਮੈਂ ਗਈ (main gayi), and a group ਅਸੀਂ ਗਏ (asi gaye).',
            ],
            examples: [
                { gurmukhi: 'ਮੈਂ ਘਰ ਗਿਆ', roman: 'Main ghar gaya', english: 'I went home (a man speaking)' },
                { gurmukhi: 'ਮੈਂ ਘਰ ਗਈ', roman: 'Main ghar gayi', english: 'I went home (a woman speaking)' },
                { gurmukhi: 'ਉਹ ਕੱਲ੍ਹ ਆਇਆ', roman: 'Oh kal aaya', english: 'He came yesterday' },
                { gurmukhi: 'ਉਹ ਬੈਠ ਗਈ', roman: 'Oh baith gayi', english: 'She sat down' },
                { gurmukhi: 'ਅਸੀਂ ਥੱਕ ਗਏ', roman: 'Asi thakk gaye', english: 'We got tired' },
            ],
        },
        {
            heading: 'Did, ate, made: the verb follows the thing',
            body: [
                'For verbs that do something to something, like eating, making, saying and seeing, Punjabi flips it: the past verb agrees with the thing, not the person. ਮੈਂ ਰੋਟੀ ਖਾਧੀ (main roti khadhi): roti is feminine, so khadhi. ਮੈਂ ਅੰਬ ਖਾਧਾ (main amb khadha): a mango is masculine, so khadha. Who ate doesn’t matter.',
                'That answers one of the most common learner questions: why kita and not kiti? ਮੈਂ ਕੰਮ ਕੀਤਾ (main kamm kita), because ਕੰਮ, work, is masculine. ਮੈਂ ਗੱਲ ਕੀਤੀ (main gall kiti), because ਗੱਲ, a talk, is feminine.',
            ],
            examples: [
                { gurmukhi: 'ਮੈਂ ਰੋਟੀ ਖਾਧੀ', roman: 'Main roti khadhi', english: 'I ate (roti)', note: 'ਰੋਟੀ is feminine, so ਖਾਧੀ.' },
                { gurmukhi: 'ਮੈਂ ਅੰਬ ਖਾਧਾ', roman: 'Main amb khadha', english: 'I ate a mango', note: 'ਅੰਬ is masculine, so ਖਾਧਾ.' },
                { gurmukhi: 'ਮੈਂ ਕੰਮ ਕੀਤਾ', roman: 'Main kamm kita', english: 'I did the work' },
                { gurmukhi: 'ਮੈਂ ਗੱਲ ਕੀਤੀ', roman: 'Main gall kiti', english: 'I had a talk', note: 'ਗੱਲ is feminine.' },
                { gurmukhi: 'ਮੈਂ ਫ਼ਿਲਮ ਦੇਖੀ', roman: 'Main film dekhi', english: 'I watched a film', note: 'ਫ਼ਿਲਮ is feminine.' },
            ],
        },
        {
            heading: 'ਨੇ (ne): who did it',
            body: [
                'With those same verbs, a person named by a noun, or by he, she or they, takes ਨੇ (ne): ਮੰਮੀ ਨੇ, ਉਸ ਨੇ, ਉਹਨਾਂ ਨੇ. Since the verb is busy agreeing with the thing, ne is what tells you who did it.',
                'I, you and we don’t take ne in Punjabi: it is ਮੈਂ ਰੋਟੀ ਖਾਧੀ, never ਮੈਂ ਨੇ. If you have heard “maine” in Hindi, leave it there.',
            ],
            examples: [
                { gurmukhi: 'ਮੰਮੀ ਨੇ ਦਾਲ ਬਣਾਈ', roman: 'Mummy ne daal banayi', english: 'Mom made daal' },
                { gurmukhi: 'ਪਾਪਾ ਨੇ ਚਾਹ ਬਣਾਈ', roman: 'Papa ne chaa banayi', english: 'Dad made tea' },
                { gurmukhi: 'ਉਸ ਨੇ ਕਿਤਾਬ ਪੜ੍ਹੀ', roman: 'Us ne kitaab parhi', english: 'He (or she) read the book' },
                { gurmukhi: 'ਉਹਨਾਂ ਨੇ ਕੀ ਕਿਹਾ?', roman: 'Unhan ne ki kiha?', english: 'What did they say?' },
            ],
            tip: 'Whenever you hear ne, the verb after it matches the thing, not the person. If the thing has ਨੂੰ after it, the verb stays -a: ਉਸ ਨੇ ਕੁੜੀ ਨੂੰ ਦੇਖਿਆ (us ne kurhi nu dekhia), he or she saw the girl.',
        },
        {
            heading: 'The everyday irregular pasts, and si',
            body: [
                'A few everyday verbs have past forms of their own. They are most of what you will say, so they are worth learning as words. Add ਸੀ (si) for a further past: ਮੈਂ ਗਿਆ ਸੀ, I had gone.',
            ],
            examples: [
                { gurmukhi: 'ਕੀਤਾ', roman: 'kita', english: 'did, from karna' },
                { gurmukhi: 'ਦਿੱਤਾ', roman: 'ditta', english: 'gave, from dena' },
                { gurmukhi: 'ਲਿਆ', roman: 'lia', english: 'took, from laina' },
                { gurmukhi: 'ਖਾਧਾ', roman: 'khadha', english: 'ate, from khana' },
                { gurmukhi: 'ਪੀਤਾ', roman: 'pita', english: 'drank, from pina', note: 'Romanized like ਪਿਤਾ (pita, father). The Gurmukhi tells them apart.' },
                { gurmukhi: 'ਕਿਹਾ', roman: 'kiha', english: 'said, from kehna' },
                { gurmukhi: 'ਆਇਆ', roman: 'aaya', english: 'came, from auna' },
                { gurmukhi: 'ਗਿਆ', roman: 'gaya', english: 'went, from jana' },
                { gurmukhi: 'ਹੋਇਆ', roman: 'hoya', english: 'happened, became, from hona' },
            ],
        },
    ],
    quiz: [
        {
            kind: 'choice',
            prompt: 'A woman says “I went home”: Main ghar ___',
            choices: ['gayi', 'gaya', 'gaye'],
            choicesLang: 'pa-Latn',
            answer: 'gayi',
        },
        {
            kind: 'choice',
            prompt: 'I ate roti: Main roti ___',
            choices: ['khadhi', 'khadha', 'khadhe'],
            choicesLang: 'pa-Latn',
            answer: 'khadhi',
            explanation: 'Roti is feminine, and a past verb with an object agrees with the object.',
        },
        {
            kind: 'choice',
            prompt: 'I did the work: Main kamm ___',
            choices: ['kita', 'kiti', 'kite'],
            choicesLang: 'pa-Latn',
            answer: 'kita',
            explanation: 'ਕੰਮ (work) is masculine.',
        },
        {
            kind: 'choice',
            prompt: 'Why is it Mummy ne daal banayi, with banayi?',
            choices: ['Daal is feminine', 'Mummy is a woman', 'Banayi never changes'],
            answer: 'Daal is feminine',
        },
        {
            kind: 'choice',
            prompt: 'Which is right in Punjabi?',
            choices: ['Main roti khadhi', 'Main ne roti khadhi'],
            choicesLang: 'pa-Latn',
            answer: 'Main roti khadhi',
            explanation: 'I, you and we don’t take ne in Punjabi.',
        },
        {
            kind: 'typed',
            prompt: 'Ask “What did they say?”',
            answer: 'Unhan ne ki kiha?',
            accept: ['Unha ne ki kiha?', 'Ohna ne ki kiha?'],
        },
        {
            kind: 'typed',
            prompt: 'Say “He came yesterday.”',
            answer: 'Oh kal aaya',
        },
    ],
};

export default lesson;
