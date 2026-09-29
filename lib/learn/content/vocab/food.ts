// Vocabulary: food and the kitchen. Types: lib/learn/config.ts.
//
// AI-drafted, pending review by a fluent speaker. Spellings follow the
// phrasebook (roti, pani, chaa, tarhka, suaad, makki), then the house rules,
// which double a letter under addak (duddh) except kh (makhan).
//
// Open questions for that review:
// - Dialect choices: ਚੌਲ (chaul) over ਚਾਵਲ, ਪਰੌਂਠਾ (parauntha).
// - duddh, where most families write dudh; ata for ਆਟਾ.

import type { VocabWord } from '../../config';

const words: VocabWord[] = [
    { id: 'food-roti', topic: 'food', gurmukhi: 'ਰੋਟੀ', roman: 'roti', english: 'roti, flatbread; a meal', pos: 'noun', gender: 'f' },
    { id: 'food-parauntha', topic: 'food', gurmukhi: 'ਪਰੌਂਠਾ', roman: 'parauntha', english: 'paratha, a flaky or stuffed flatbread', pos: 'noun', gender: 'm', accept: ['paratha', 'parontha'] },
    { id: 'food-daal', topic: 'food', gurmukhi: 'ਦਾਲ', roman: 'daal', english: 'lentils; daal', pos: 'noun', gender: 'f' },
    { id: 'food-sabzi', topic: 'food', gurmukhi: 'ਸਬਜ਼ੀ', roman: 'sabzi', english: 'vegetables; a vegetable dish', pos: 'noun', gender: 'f', accept: ['sabji'] },
    { id: 'food-saag', topic: 'food', gurmukhi: 'ਸਾਗ', roman: 'saag', english: 'saag, cooked greens', pos: 'noun', gender: 'm' },
    { id: 'food-makki', topic: 'food', gurmukhi: 'ਮੱਕੀ', roman: 'makki', english: 'corn', pos: 'noun', gender: 'f', note: 'Makki di roti te sarhon da saag: the winter classic.' },
    { id: 'food-chaul', topic: 'food', gurmukhi: 'ਚੌਲ', roman: 'chaul', english: 'rice', pos: 'noun', gender: 'm', accept: ['chawal', 'chol'] },
    { id: 'food-achaar', topic: 'food', gurmukhi: 'ਅਚਾਰ', roman: 'achaar', english: 'pickle', pos: 'noun', gender: 'm' },
    { id: 'food-chaa', topic: 'food', gurmukhi: 'ਚਾਹ', roman: 'chaa', english: 'tea', pos: 'noun', gender: 'f', accept: ['chah'] },
    { id: 'food-duddh', topic: 'food', gurmukhi: 'ਦੁੱਧ', roman: 'duddh', english: 'milk', pos: 'noun', gender: 'm', accept: ['dudh', 'doodh'] },
    { id: 'food-lassi', topic: 'food', gurmukhi: 'ਲੱਸੀ', roman: 'lassi', english: 'lassi, a yogurt drink', pos: 'noun', gender: 'f' },
    { id: 'food-dahi', topic: 'food', gurmukhi: 'ਦਹੀਂ', roman: 'dahi', english: 'yogurt', pos: 'noun', gender: 'm', note: 'Masculine, despite its -i.' },
    { id: 'food-makhan', topic: 'food', gurmukhi: 'ਮੱਖਣ', roman: 'makhan', english: 'butter', pos: 'noun', gender: 'm', accept: ['makkhan'] },
    { id: 'food-pani', topic: 'food', gurmukhi: 'ਪਾਣੀ', roman: 'pani', english: 'water', pos: 'noun', gender: 'm', note: 'Masculine, despite its -i.' },
    { id: 'food-ata', topic: 'food', gurmukhi: 'ਆਟਾ', roman: 'ata', english: 'flour', pos: 'noun', gender: 'm', accept: ['atta'] },
    { id: 'food-loon', topic: 'food', gurmukhi: 'ਲੂਣ', roman: 'loon', english: 'salt', pos: 'noun', gender: 'm' },
    { id: 'food-mirch', topic: 'food', gurmukhi: 'ਮਿਰਚ', roman: 'mirch', english: 'chili; pepper', pos: 'noun', gender: 'f' },
    { id: 'food-tarhka', topic: 'food', gurmukhi: 'ਤੜਕਾ', roman: 'tarhka', english: 'the sizzling spice base of a dish', pos: 'noun', gender: 'm', accept: ['tadka', 'tarka'] },
    { id: 'food-khana', topic: 'food', gurmukhi: 'ਖਾਣਾ', roman: 'khana', english: 'food; a meal', pos: 'noun', gender: 'm' },
    { id: 'food-bhukh', topic: 'food', gurmukhi: 'ਭੁੱਖ', roman: 'bhukh', english: 'hunger', pos: 'noun', gender: 'f', note: 'Mainu bhukh lagi hai: I am hungry.' },
    { id: 'food-suaad', topic: 'food', gurmukhi: 'ਸੁਆਦ', roman: 'suaad', english: 'taste; tasty', pos: 'noun', gender: 'm', note: 'Bahut suaad hai: it is delicious.' },
    { id: 'food-mitha', topic: 'food', gurmukhi: 'ਮਿੱਠਾ', roman: 'mitha', english: 'sweet', pos: 'adjective' },
];

export default words;
