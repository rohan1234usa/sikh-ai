// Vocabulary: numbers and time. Types: lib/learn/config.ts.
//
// AI-drafted, pending review by a fluent speaker. Punjabi numbers are
// irregular and vary by region, so they need a careful check. Spellings
// follow the house rules: addak doubles a letter (ikk, satt) except th
// (ath); a long vowel in a one-syllable word is doubled (chaar, veeh).
//
// Open questions for that review:
// - veeh for ਵੀਹ (twenty), where families often write vee.
// - Is ਵਜੇ (vaje, o'clock) better taught as a phrase with a number?

import type { VocabWord } from '../../config';

const words: VocabWord[] = [
    { id: 'numbers-time-ikk', topic: 'numbers-time', gurmukhi: 'ਇੱਕ', roman: 'ikk', english: 'one', pos: 'number', accept: ['ik', 'ek'] },
    { id: 'numbers-time-do', topic: 'numbers-time', gurmukhi: 'ਦੋ', roman: 'do', english: 'two', pos: 'number' },
    { id: 'numbers-time-tinn', topic: 'numbers-time', gurmukhi: 'ਤਿੰਨ', roman: 'tinn', english: 'three', pos: 'number' },
    { id: 'numbers-time-chaar', topic: 'numbers-time', gurmukhi: 'ਚਾਰ', roman: 'chaar', english: 'four', pos: 'number' },
    { id: 'numbers-time-panj', topic: 'numbers-time', gurmukhi: 'ਪੰਜ', roman: 'panj', english: 'five', pos: 'number' },
    { id: 'numbers-time-chhe', topic: 'numbers-time', gurmukhi: 'ਛੇ', roman: 'chhe', english: 'six', pos: 'number', accept: ['che'] },
    { id: 'numbers-time-satt', topic: 'numbers-time', gurmukhi: 'ਸੱਤ', roman: 'satt', english: 'seven', pos: 'number' },
    { id: 'numbers-time-ath', topic: 'numbers-time', gurmukhi: 'ਅੱਠ', roman: 'ath', english: 'eight', pos: 'number', accept: ['atth'] },
    { id: 'numbers-time-naun', topic: 'numbers-time', gurmukhi: 'ਨੌਂ', roman: 'naun', english: 'nine', pos: 'number', accept: ['nau'] },
    { id: 'numbers-time-das', topic: 'numbers-time', gurmukhi: 'ਦਸ', roman: 'das', english: 'ten', pos: 'number' },
    { id: 'numbers-time-veeh', topic: 'numbers-time', gurmukhi: 'ਵੀਹ', roman: 'veeh', english: 'twenty', pos: 'number', accept: ['vee'] },
    { id: 'numbers-time-sau', topic: 'numbers-time', gurmukhi: 'ਸੌ', roman: 'sau', english: 'a hundred', pos: 'number' },
    { id: 'numbers-time-hazaar', topic: 'numbers-time', gurmukhi: 'ਹਜ਼ਾਰ', roman: 'hazaar', english: 'a thousand', pos: 'number' },
    { id: 'numbers-time-ajj', topic: 'numbers-time', gurmukhi: 'ਅੱਜ', roman: 'ajj', english: 'today', pos: 'adverb' },
    { id: 'numbers-time-kal', topic: 'numbers-time', gurmukhi: 'ਕੱਲ੍ਹ', roman: 'kal', english: 'yesterday; tomorrow', pos: 'adverb', note: 'The tense tells you which.' },
    { id: 'numbers-time-parson', topic: 'numbers-time', gurmukhi: 'ਪਰਸੋਂ', roman: 'parson', english: 'the day before yesterday; the day after tomorrow', pos: 'adverb' },
    { id: 'numbers-time-hun', topic: 'numbers-time', gurmukhi: 'ਹੁਣ', roman: 'hun', english: 'now', pos: 'adverb' },
    { id: 'numbers-time-pehlan', topic: 'numbers-time', gurmukhi: 'ਪਹਿਲਾਂ', roman: 'pehlan', english: 'before; first', pos: 'adverb' },
    { id: 'numbers-time-baad-vich', topic: 'numbers-time', gurmukhi: 'ਬਾਅਦ ਵਿੱਚ', roman: 'baad vich', english: 'later; afterwards', pos: 'adverb' },
    { id: 'numbers-time-vaje', topic: 'numbers-time', gurmukhi: 'ਵਜੇ', roman: 'vaje', english: 'o’clock', pos: 'adverb', example: { gurmukhi: 'ਚਾਰ ਵਜੇ', roman: 'chaar vaje', english: 'at four o’clock' } },
    { id: 'numbers-time-dupehar', topic: 'numbers-time', gurmukhi: 'ਦੁਪਹਿਰ', roman: 'dupehar', english: 'midday; afternoon', pos: 'noun', gender: 'f' },
    { id: 'numbers-time-shaam', topic: 'numbers-time', gurmukhi: 'ਸ਼ਾਮ', roman: 'shaam', english: 'evening', pos: 'noun', gender: 'f' },
    { id: 'numbers-time-ghanta', topic: 'numbers-time', gurmukhi: 'ਘੰਟਾ', roman: 'ghanta', english: 'an hour', pos: 'noun', gender: 'm' },
    { id: 'numbers-time-hafta', topic: 'numbers-time', gurmukhi: 'ਹਫ਼ਤਾ', roman: 'hafta', english: 'a week', pos: 'noun', gender: 'm' },
    { id: 'numbers-time-mahina', topic: 'numbers-time', gurmukhi: 'ਮਹੀਨਾ', roman: 'mahina', english: 'a month', pos: 'noun', gender: 'm' },
    { id: 'numbers-time-saal', topic: 'numbers-time', gurmukhi: 'ਸਾਲ', roman: 'saal', english: 'a year', pos: 'noun', gender: 'm' },
];

export default words;
