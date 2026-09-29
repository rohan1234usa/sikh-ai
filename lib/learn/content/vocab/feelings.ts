// Vocabulary: feelings and small talk, including the weather. Types:
// lib/learn/config.ts.
//
// AI-drafted, pending review by a fluent speaker. Spellings follow the
// phrasebook (vadhia, sohna), then the romanized interface's pattern for
// ਪਿਆ- (pyaar, as in grammar lesson 11's pyaas), then the house rules.
//
// Open questions for that review:
// - Genders to confirm: ਯਾਦ (f), ਪਸੰਦ (f), ਚਿੰਤਾ (f), ਸ਼ਰਮ (f).

import type { VocabWord } from '../../config';

const words: VocabWord[] = [
    { id: 'feelings-khush', topic: 'feelings', gurmukhi: 'ਖ਼ੁਸ਼', roman: 'khush', english: 'happy', pos: 'adjective' },
    { id: 'feelings-udaas', topic: 'feelings', gurmukhi: 'ਉਦਾਸ', roman: 'udaas', english: 'sad', pos: 'adjective' },
    { id: 'feelings-hairaan', topic: 'feelings', gurmukhi: 'ਹੈਰਾਨ', roman: 'hairaan', english: 'surprised', pos: 'adjective' },
    { id: 'feelings-pareshaan', topic: 'feelings', gurmukhi: 'ਪਰੇਸ਼ਾਨ', roman: 'pareshaan', english: 'upset; troubled', pos: 'adjective' },
    { id: 'feelings-gussa', topic: 'feelings', gurmukhi: 'ਗੁੱਸਾ', roman: 'gussa', english: 'anger', pos: 'noun', gender: 'm', note: 'Mainu gussa aaya: I got angry, “anger came to me”.' },
    { id: 'feelings-dar', topic: 'feelings', gurmukhi: 'ਡਰ', roman: 'dar', english: 'fear', pos: 'noun', gender: 'm' },
    { id: 'feelings-pyaar', topic: 'feelings', gurmukhi: 'ਪਿਆਰ', roman: 'pyaar', english: 'love', pos: 'noun', gender: 'm', accept: ['pyar', 'piaar'] },
    { id: 'feelings-sharam', topic: 'feelings', gurmukhi: 'ਸ਼ਰਮ', roman: 'sharam', english: 'shyness; embarrassment', pos: 'noun', gender: 'f' },
    { id: 'feelings-maza', topic: 'feelings', gurmukhi: 'ਮਜ਼ਾ', roman: 'maza', english: 'fun; enjoyment', pos: 'noun', gender: 'm', note: 'Bahut maza aaya: it was great fun.' },
    { id: 'feelings-chinta', topic: 'feelings', gurmukhi: 'ਚਿੰਤਾ', roman: 'chinta', english: 'worry', pos: 'noun', gender: 'f' },
    { id: 'feelings-yaad', topic: 'feelings', gurmukhi: 'ਯਾਦ', roman: 'yaad', english: 'memory; missing someone', pos: 'noun', gender: 'f', note: 'Mainu tuhadi yaad aundi hai: I miss you.' },
    { id: 'feelings-pasand', topic: 'feelings', gurmukhi: 'ਪਸੰਦ', roman: 'pasand', english: 'liking; your taste', pos: 'noun', gender: 'f', note: 'Mainu pasand hai: I like it.' },
    { id: 'feelings-sohna', topic: 'feelings', gurmukhi: 'ਸੋਹਣਾ', roman: 'sohna', english: 'beautiful; handsome', pos: 'adjective' },
    { id: 'feelings-vadhia', topic: 'feelings', gurmukhi: 'ਵਧੀਆ', roman: 'vadhia', english: 'great; excellent', pos: 'adjective', accept: ['vadiya', 'vadhiya'] },
    { id: 'feelings-mausam', topic: 'feelings', gurmukhi: 'ਮੌਸਮ', roman: 'mausam', english: 'weather', pos: 'noun', gender: 'm' },
    { id: 'feelings-garmi', topic: 'feelings', gurmukhi: 'ਗਰਮੀ', roman: 'garmi', english: 'heat; summer', pos: 'noun', gender: 'f' },
    { id: 'feelings-sardi', topic: 'feelings', gurmukhi: 'ਸਰਦੀ', roman: 'sardi', english: 'cold; winter', pos: 'noun', gender: 'f' },
    { id: 'feelings-meenh', topic: 'feelings', gurmukhi: 'ਮੀਂਹ', roman: 'meenh', english: 'rain', pos: 'noun', gender: 'm', accept: ['meeh', 'mee'] },
];

export default words;
