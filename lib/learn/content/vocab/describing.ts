// Vocabulary: colors and describing words. Adjectives ending in -a change
// to match their noun (changa, changi, change); those ending in a consonant
// never change. Types: lib/learn/config.ts.
//
// AI-drafted, pending review by a fluent speaker. Spellings follow the house
// rules: a long vowel outside a word's last syllable is written once (pila,
// nila), and ਾਂ at the end of a longer word is an (navan).
//
// Open questions for that review:
// - pila and nila, where families often write peela and neela.
// - thandha for ਠੰਢਾ, where most write thanda.

import type { VocabWord } from '../../config';

const words: VocabWord[] = [
    { id: 'describing-laal', topic: 'describing', gurmukhi: 'ਲਾਲ', roman: 'laal', english: 'red', pos: 'adjective' },
    { id: 'describing-chitta', topic: 'describing', gurmukhi: 'ਚਿੱਟਾ', roman: 'chitta', english: 'white', pos: 'adjective' },
    { id: 'describing-kala', topic: 'describing', gurmukhi: 'ਕਾਲਾ', roman: 'kala', english: 'black', pos: 'adjective' },
    { id: 'describing-pila', topic: 'describing', gurmukhi: 'ਪੀਲਾ', roman: 'pila', english: 'yellow', pos: 'adjective' },
    { id: 'describing-hara', topic: 'describing', gurmukhi: 'ਹਰਾ', roman: 'hara', english: 'green', pos: 'adjective' },
    { id: 'describing-nila', topic: 'describing', gurmukhi: 'ਨੀਲਾ', roman: 'nila', english: 'blue', pos: 'adjective' },
    { id: 'describing-gulabi', topic: 'describing', gurmukhi: 'ਗੁਲਾਬੀ', roman: 'gulabi', english: 'pink', pos: 'adjective' },
    { id: 'describing-vadda', topic: 'describing', gurmukhi: 'ਵੱਡਾ', roman: 'vadda', english: 'big; older', pos: 'adjective' },
    { id: 'describing-chhota', topic: 'describing', gurmukhi: 'ਛੋਟਾ', roman: 'chhota', english: 'small; younger', pos: 'adjective', note: 'Chhota bhra: your younger brother.' },
    { id: 'describing-lamba', topic: 'describing', gurmukhi: 'ਲੰਬਾ', roman: 'lamba', english: 'tall; long', pos: 'adjective' },
    { id: 'describing-mota', topic: 'describing', gurmukhi: 'ਮੋਟਾ', roman: 'mota', english: 'fat; thick', pos: 'adjective' },
    { id: 'describing-patla', topic: 'describing', gurmukhi: 'ਪਤਲਾ', roman: 'patla', english: 'thin', pos: 'adjective' },
    { id: 'describing-navan', topic: 'describing', gurmukhi: 'ਨਵਾਂ', roman: 'navan', english: 'new', pos: 'adjective', accept: ['nava', 'naya'] },
    { id: 'describing-purana', topic: 'describing', gurmukhi: 'ਪੁਰਾਣਾ', roman: 'purana', english: 'old (of things)', pos: 'adjective' },
    { id: 'describing-garam', topic: 'describing', gurmukhi: 'ਗਰਮ', roman: 'garam', english: 'hot; warm', pos: 'adjective' },
    { id: 'describing-thandha', topic: 'describing', gurmukhi: 'ਠੰਢਾ', roman: 'thandha', english: 'cold; cool', pos: 'adjective', accept: ['thanda'] },
    { id: 'describing-changa', topic: 'describing', gurmukhi: 'ਚੰਗਾ', roman: 'changa', english: 'good', pos: 'adjective' },
    { id: 'describing-bura', topic: 'describing', gurmukhi: 'ਬੁਰਾ', roman: 'bura', english: 'bad', pos: 'adjective' },
    { id: 'describing-saaf', topic: 'describing', gurmukhi: 'ਸਾਫ਼', roman: 'saaf', english: 'clean', pos: 'adjective' },
    { id: 'describing-ganda', topic: 'describing', gurmukhi: 'ਗੰਦਾ', roman: 'ganda', english: 'dirty', pos: 'adjective' },
];

export default words;
