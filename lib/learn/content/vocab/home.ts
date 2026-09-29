// Vocabulary: home and the daily routine. Types: lib/learn/config.ts.
//
// AI-drafted, pending review by a fluent speaker. Spellings follow the
// phrasebook, then the house rules; English loanwords keep their English
// spelling (school). Nouns ending in -ai are written -ai (safai, rasoi), as
// the phrasebook writes koi.
//
// Open questions for that review:
// - Dialect choices: ਦਰਵਾਜ਼ਾ over ਬੂਹਾ for door, ਮੰਜਾ for bed.
// - ਭਾਂਡੇ for dishes, listed in the plural.

import type { VocabWord } from '../../config';

const words: VocabWord[] = [
    { id: 'home-ghar', topic: 'home', gurmukhi: 'ਘਰ', roman: 'ghar', english: 'home, house', pos: 'noun', gender: 'm' },
    { id: 'home-kamra', topic: 'home', gurmukhi: 'ਕਮਰਾ', roman: 'kamra', english: 'room', pos: 'noun', gender: 'm' },
    { id: 'home-rasoi', topic: 'home', gurmukhi: 'ਰਸੋਈ', roman: 'rasoi', english: 'kitchen', pos: 'noun', gender: 'f' },
    { id: 'home-darvaza', topic: 'home', gurmukhi: 'ਦਰਵਾਜ਼ਾ', roman: 'darvaza', english: 'door', pos: 'noun', gender: 'm', note: 'Many families say ਬੂਹਾ (buha).' },
    { id: 'home-khirhki', topic: 'home', gurmukhi: 'ਖਿੜਕੀ', roman: 'khirhki', english: 'window', pos: 'noun', gender: 'f', accept: ['khidki', 'khirki'] },
    { id: 'home-manja', topic: 'home', gurmukhi: 'ਮੰਜਾ', roman: 'manja', english: 'bed; a woven cot', pos: 'noun', gender: 'm' },
    { id: 'home-kursi', topic: 'home', gurmukhi: 'ਕੁਰਸੀ', roman: 'kursi', english: 'chair', pos: 'noun', gender: 'f' },
    { id: 'home-mez', topic: 'home', gurmukhi: 'ਮੇਜ਼', roman: 'mez', english: 'table', pos: 'noun', gender: 'm', accept: ['mej'] },
    { id: 'home-bhande', topic: 'home', gurmukhi: 'ਭਾਂਡੇ', roman: 'bhande', english: 'the dishes', pos: 'noun', gender: 'm' },
    { id: 'home-jutti', topic: 'home', gurmukhi: 'ਜੁੱਤੀ', roman: 'jutti', english: 'shoe; a Punjabi jutti', pos: 'noun', gender: 'f' },
    { id: 'home-chabi', topic: 'home', gurmukhi: 'ਚਾਬੀ', roman: 'chabi', english: 'key', pos: 'noun', gender: 'f' },
    { id: 'home-gaddi', topic: 'home', gurmukhi: 'ਗੱਡੀ', roman: 'gaddi', english: 'car', pos: 'noun', gender: 'f' },
    { id: 'home-kamm', topic: 'home', gurmukhi: 'ਕੰਮ', roman: 'kamm', english: 'work; a job; a chore', pos: 'noun', gender: 'm', accept: ['kam'] },
    { id: 'home-safai', topic: 'home', gurmukhi: 'ਸਫ਼ਾਈ', roman: 'safai', english: 'cleaning', pos: 'noun', gender: 'f' },
    { id: 'home-school', topic: 'home', gurmukhi: 'ਸਕੂਲ', roman: 'school', english: 'school', pos: 'noun', gender: 'm' },
    { id: 'home-savere', topic: 'home', gurmukhi: 'ਸਵੇਰੇ', roman: 'savere', english: 'in the morning', pos: 'adverb' },
    { id: 'home-raat', topic: 'home', gurmukhi: 'ਰਾਤ', roman: 'raat', english: 'night', pos: 'noun', gender: 'f' },
    {
        id: 'home-uthna', topic: 'home', gurmukhi: 'ਉੱਠਣਾ', roman: 'uthna', english: 'to get up; to wake up', pos: 'verb',
        example: { gurmukhi: 'ਮੈਂ ਛੇ ਵਜੇ ਉੱਠਦਾ ਹਾਂ', roman: 'Main chhe vaje uthda haan', english: 'I get up at six (a man speaking)' },
    },
    {
        id: 'home-nahauna', topic: 'home', gurmukhi: 'ਨਹਾਉਣਾ', roman: 'nahauna', english: 'to bathe; to shower', pos: 'verb',
        example: { gurmukhi: 'ਪਹਿਲਾਂ ਨਹਾ ਲਵੋ', roman: 'Pehlan naha lavo', english: 'Have a shower first' },
    },
    {
        id: 'home-sauna', topic: 'home', gurmukhi: 'ਸੌਣਾ', roman: 'sauna', english: 'to sleep', pos: 'verb',
        example: { gurmukhi: 'ਬੱਚੇ ਸੌਂ ਗਏ', roman: 'Bache saun gaye', english: 'The kids have fallen asleep' },
    },
];

export default words;
