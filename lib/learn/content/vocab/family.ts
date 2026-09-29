// Vocabulary: family. Punjabi names every relative by side and by age, so
// this list is mostly kinship terms. Types: lib/learn/config.ts.
//
// AI-drafted, pending review by a fluent speaker. Spellings follow the
// phrasebook (tests/learn/content.test.ts checks it), then the romanized
// interface, then the house rules. Kinship words are listed without ji;
// each note says how it is used.
//
// Open questions for that review:
// - Regional variants: masarh or masar, phuphar or phuphad, tayi or tai.
// - Is nanke/dadke better as one entry each, or as a pair?

import type { VocabWord } from '../../config';

const words: VocabWord[] = [
    { id: 'family-mummy', topic: 'family', gurmukhi: 'ਮੰਮੀ', roman: 'mummy', english: 'mom', sameAs: ['family-mata'], pos: 'noun', gender: 'f', accept: ['mommy'] },
    { id: 'family-papa', topic: 'family', gurmukhi: 'ਪਾਪਾ', roman: 'papa', english: 'dad', sameAs: ['family-pita'], pos: 'noun', gender: 'm', note: 'Many families say daddy or bhapa ji instead.' },
    { id: 'family-mata', topic: 'family', gurmukhi: 'ਮਾਤਾ', roman: 'mata', english: 'mother (formal)', pos: 'noun', gender: 'f', note: 'Said with ji: mata ji. Also a respectful way to address any elderly woman.' },
    { id: 'family-pita', topic: 'family', gurmukhi: 'ਪਿਤਾ', roman: 'pita', english: 'father (formal)', pos: 'noun', gender: 'm', note: 'Said with ji: pita ji.' },
    { id: 'family-bhra', topic: 'family', gurmukhi: 'ਭਰਾ', roman: 'bhra', english: 'brother', pos: 'noun', gender: 'm', accept: ['pra'] },
    { id: 'family-veer', topic: 'family', gurmukhi: 'ਵੀਰ', roman: 'veer', english: 'brother (affectionate)', pos: 'noun', gender: 'm', note: 'Veer ji is also any man you respect like a brother.' },
    { id: 'family-bhain', topic: 'family', gurmukhi: 'ਭੈਣ', roman: 'bhain', english: 'sister', pos: 'noun', gender: 'f', note: 'Bhain ji, or penji for short, for any woman you respect like a sister.' },
    { id: 'family-dada', topic: 'family', gurmukhi: 'ਦਾਦਾ', roman: 'dada', english: 'grandfather, your father’s father', pos: 'noun', gender: 'm' },
    { id: 'family-dadi', topic: 'family', gurmukhi: 'ਦਾਦੀ', roman: 'dadi', english: 'grandmother, your father’s mother', pos: 'noun', gender: 'f' },
    { id: 'family-nana', topic: 'family', gurmukhi: 'ਨਾਨਾ', roman: 'nana', english: 'grandfather, your mother’s father', pos: 'noun', gender: 'm' },
    { id: 'family-nani', topic: 'family', gurmukhi: 'ਨਾਨੀ', roman: 'nani', english: 'grandmother, your mother’s mother', pos: 'noun', gender: 'f' },
    { id: 'family-chacha', topic: 'family', gurmukhi: 'ਚਾਚਾ', roman: 'chacha', english: 'uncle, your father’s younger brother', pos: 'noun', gender: 'm', note: 'His wife is your chachi.' },
    { id: 'family-chachi', topic: 'family', gurmukhi: 'ਚਾਚੀ', roman: 'chachi', english: 'aunt, your chacha’s wife', pos: 'noun', gender: 'f' },
    { id: 'family-taya', topic: 'family', gurmukhi: 'ਤਾਇਆ', roman: 'taya', english: 'uncle, your father’s older brother', pos: 'noun', gender: 'm', note: 'His wife is your tayi.' },
    { id: 'family-tayi', topic: 'family', gurmukhi: 'ਤਾਈ', roman: 'tayi', english: 'aunt, your taya’s wife', pos: 'noun', gender: 'f', accept: ['tai'] },
    { id: 'family-mama', topic: 'family', gurmukhi: 'ਮਾਮਾ', roman: 'mama', english: 'uncle, your mother’s brother', pos: 'noun', gender: 'm', note: 'Never mom. His wife is your mami.' },
    { id: 'family-mami', topic: 'family', gurmukhi: 'ਮਾਮੀ', roman: 'mami', english: 'aunt, your mama’s wife', pos: 'noun', gender: 'f' },
    { id: 'family-masi', topic: 'family', gurmukhi: 'ਮਾਸੀ', roman: 'masi', english: 'aunt, your mother’s sister', pos: 'noun', gender: 'f', note: 'Her husband is your ਮਾਸੜ (masarh).' },
    { id: 'family-bhua', topic: 'family', gurmukhi: 'ਭੂਆ', roman: 'bhua', english: 'aunt, your father’s sister', pos: 'noun', gender: 'f', note: 'Her husband is your ਫੁੱਫੜ (phuphar).' },
    { id: 'family-putt', topic: 'family', gurmukhi: 'ਪੁੱਤ', roman: 'putt', english: 'son', pos: 'noun', gender: 'm', note: 'Elders also call any child putt, affectionately.' },
    { id: 'family-dhi', topic: 'family', gurmukhi: 'ਧੀ', roman: 'dhi', english: 'daughter', pos: 'noun', gender: 'f' },
    { id: 'family-parivaar', topic: 'family', gurmukhi: 'ਪਰਿਵਾਰ', roman: 'parivaar', english: 'family', pos: 'noun', gender: 'm' },
    { id: 'family-rishtedaar', topic: 'family', gurmukhi: 'ਰਿਸ਼ਤੇਦਾਰ', roman: 'rishtedaar', english: 'relative', pos: 'noun', gender: 'm' },
    { id: 'family-nanke', topic: 'family', gurmukhi: 'ਨਾਨਕੇ', roman: 'nanke', english: 'your mother’s side of the family', pos: 'noun', gender: 'm', note: 'Your father’s side is dadke.' },
];

export default words;
