// Script track, lesson 8: Punjabi's tones, and the letters that make them.
// Types: lib/learn/config.ts.
//
// AI-drafted, pending review by a fluent speaker. This lesson is the easiest
// place in the course for a confident-sounding mistake, so it needs the most
// careful check: which words carry a low tone, which a high one, and the
// descriptions of each. The facts it rests on: at the start of a word
// ਘ ਝ ਢ ਧ ਭ lose their voicing and breath (ਘ sounds like ਕ) and the vowel
// after them is low; after a vowel, they and ਹ make that vowel high and
// falling. The romanization keeps gh, jh, dh, bh and the h
// (lib/translate/romanization.ts), so a spelling still shows
// where a tone is.
//
// Open questions for that review:
// - ਕੋੜਾ / ਘੋੜਾ (whip, horse) as the minimal pair.
// - Are the "sounds like" hints (kàr, pèn) helpful, or confusing next to
//   the house romanization?

import type { LessonBody } from '../../config';

const lesson: LessonBody = {
    sections: [
        {
            heading: 'Punjabi has tones',
            body: [
                'Punjabi is unusual among the languages of its family: it has tones. The pitch of your voice on a vowel can tell two words apart. You already hear them in every family conversation; this lesson gives them names.',
                'The tones come from letters the alphabet wrote as breathy sounds: ਘ ਝ ਢ ਧ ਭ, and ਹ in the middle or at the end of a word. Over the centuries the breath disappeared, and a change of pitch took its place.',
            ],
        },
        {
            heading: 'At the start of a word: a low tone',
            body: [
                'When ਘ ਝ ਢ ਧ ਭ start a word, say the plain letter from the start of their row instead: ਘ like ਕ, ਝ like ਚ, ਢ like ਟ, ਧ like ਤ, ਭ like ਪ. The vowel after it starts low and climbs back up.',
                'So ਘਰ sounds like “kàr”, with a low a, and ਭੈਣ like “pèn”. Nobody says a breathy gh or bh.',
            ],
            examples: [
                { gurmukhi: 'ਘਰ', roman: 'ghar', english: 'home, house', note: 'Sounds like kàr.' },
                { gurmukhi: 'ਭੈਣ', roman: 'bhain', english: 'sister', note: 'Sounds like pèn.' },
                { gurmukhi: 'ਧੀ', roman: 'dhi', english: 'daughter', note: 'Sounds like a low tì, the t against the teeth.' },
                { gurmukhi: 'ਝੰਡਾ', roman: 'jhanda', english: 'flag', note: 'Sounds like chànda.' },
                { gurmukhi: 'ਢੋਲ', roman: 'dhol', english: 'drum', note: 'Sounds like a low tòl, the t curled back.' },
            ],
        },
        {
            heading: 'After a vowel: a high tone',
            body: [
                'After a vowel, the same letters and ਹ make the vowel before them high: your voice rises and then falls on it. The letter itself is said plainly, as ਗ ਜ ਡ ਦ ਬ, or not at all in the case of ਹ.',
                'That is why ਚਾਹ is “chaa”: the ਹ is silent, and the aa is high.',
                'After a short a, ਹਿ sounds like e and ਹੁ like o, both high: ਸ਼ਹਿਰ is shehar, ਪਹਿਲਾਂ is pehlan, and ਬਹੁਤ, spelled bahut, sounds close to “boht”.',
            ],
            examples: [
                { gurmukhi: 'ਚਾਹ', roman: 'chaa', english: 'tea', note: 'The ਹ is silent; the aa is high.' },
                { gurmukhi: 'ਸ਼ਹਿਰ', roman: 'shehar', english: 'city', note: 'Sounds like a high shér.' },
                { gurmukhi: 'ਪਹਿਲਾਂ', roman: 'pehlan', english: 'first; before' },
                { gurmukhi: 'ਲਾਭ', roman: 'laabh', english: 'benefit, profit', note: 'Sounds like a high lááb.' },
                { gurmukhi: 'ਮੀਂਹ', roman: 'meenh', english: 'rain' },
            ],
        },
        {
            heading: 'Why the spelling keeps the h',
            body: [
                'The romanization keeps gh, jh, dh and bh, and the h of ਸ਼ਹਿਰ, because that h is how a spelling shows where the tone is. If you text ghar and dhol, keep doing it: just know that nobody says the h. The one everyday exception is ਚਾਹ, which families write chaa.',
            ],
            examples: [
                { gurmukhi: 'ਕੋੜਾ', roman: 'korha', english: 'whip', note: 'A level k.' },
                { gurmukhi: 'ਘੋੜਾ', roman: 'ghorha', english: 'horse', note: 'The same k sound, with a low tone.' },
            ],
            tip: 'Say ਕੋੜਾ and ਘੋੜਾ one after the other. The only difference is the pitch of the o.',
        },
    ],
    quiz: [
        {
            kind: 'choice',
            prompt: 'At the start of a word, ਘ sounds most like…',
            choices: ['ਕ, with a low tone after it', 'ਗ, with a puff of air', 'ਹ'],
            answer: 'ਕ, with a low tone after it',
        },
        {
            kind: 'choice',
            prompt: 'In ਚਾਹ (tea), the ਹ…',
            choices: ['is silent and makes the aa high', 'is a strong h', 'makes the word plural'],
            answer: 'is silent and makes the aa high',
        },
        {
            kind: 'choice',
            prompt: 'Which word starts with a low tone?',
            choices: ['ਭੈਣ', 'ਪਾਣੀ', 'ਮੁੰਡਾ'],
            choicesLang: 'pa',
            answer: 'ਭੈਣ',
        },
        {
            kind: 'choice',
            prompt: 'Which letters make tones?',
            choices: ['ਘ ਝ ਢ ਧ ਭ and ਹ', 'ਕ ਚ ਟ ਤ ਪ', 'ਙ ਞ ਣ ਨ ਮ'],
            answer: 'ਘ ਝ ਢ ਧ ਭ and ਹ',
        },
        {
            kind: 'typed',
            prompt: 'Read this word. It means horse.',
            promptPa: 'ਘੋੜਾ',
            answer: 'ghorha',
            accept: ['ghora', 'ghoda'],
        },
        {
            kind: 'typed',
            prompt: 'Read this word. It means city.',
            promptPa: 'ਸ਼ਹਿਰ',
            answer: 'shehar',
            accept: ['shahar', 'shehr'],
        },
    ],
};

export default lesson;
