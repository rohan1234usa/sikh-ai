// Vocabulary: the body and health. Types: lib/learn/config.ts.
//
// AI-drafted, pending review by a fluent speaker. Spellings follow the
// house rules: addak doubles a letter (kann, nakk, latt, dhidd) except kh
// and th (akh, hath); a long vowel in a one-syllable word is doubled
// (moonh); nouns ending in -ai are written -ai (davai).
//
// Open questions for that review:
// - moonh for ਮੂੰਹ, where families often write munh or mooh.
// - Genders to confirm: ਲੱਤ (f), ਖੰਘ (f), ਦਵਾਈ (f).

import type { VocabWord } from '../../config';

const words: VocabWord[] = [
    { id: 'body-health-sir', topic: 'body-health', gurmukhi: 'ਸਿਰ', roman: 'sir', english: 'head', pos: 'noun', gender: 'm' },
    { id: 'body-health-akh', topic: 'body-health', gurmukhi: 'ਅੱਖ', roman: 'akh', english: 'eye', pos: 'noun', gender: 'f', accept: ['akkh'] },
    { id: 'body-health-kann', topic: 'body-health', gurmukhi: 'ਕੰਨ', roman: 'kann', english: 'ear', pos: 'noun', gender: 'm' },
    { id: 'body-health-nakk', topic: 'body-health', gurmukhi: 'ਨੱਕ', roman: 'nakk', english: 'nose', pos: 'noun', gender: 'm' },
    { id: 'body-health-moonh', topic: 'body-health', gurmukhi: 'ਮੂੰਹ', roman: 'moonh', english: 'mouth; face', pos: 'noun', gender: 'm', accept: ['munh', 'mooh'] },
    { id: 'body-health-dand', topic: 'body-health', gurmukhi: 'ਦੰਦ', roman: 'dand', english: 'tooth', pos: 'noun', gender: 'm' },
    { id: 'body-health-hath', topic: 'body-health', gurmukhi: 'ਹੱਥ', roman: 'hath', english: 'hand', pos: 'noun', gender: 'm' },
    { id: 'body-health-pair', topic: 'body-health', gurmukhi: 'ਪੈਰ', roman: 'pair', english: 'foot', pos: 'noun', gender: 'm' },
    { id: 'body-health-latt', topic: 'body-health', gurmukhi: 'ਲੱਤ', roman: 'latt', english: 'leg', pos: 'noun', gender: 'f' },
    { id: 'body-health-dhidd', topic: 'body-health', gurmukhi: 'ਢਿੱਡ', roman: 'dhidd', english: 'stomach; belly', pos: 'noun', gender: 'm', accept: ['dhid'] },
    { id: 'body-health-dil', topic: 'body-health', gurmukhi: 'ਦਿਲ', roman: 'dil', english: 'heart', pos: 'noun', gender: 'm' },
    {
        id: 'body-health-dard', topic: 'body-health', gurmukhi: 'ਦਰਦ', roman: 'dard', english: 'pain; ache', pos: 'noun', gender: 'm',
        example: { gurmukhi: 'ਮੇਰੇ ਸਿਰ ਵਿੱਚ ਦਰਦ ਹੈ', roman: 'Mere sir vich dard hai', english: 'I have a headache' },
    },
    { id: 'body-health-bukhaar', topic: 'body-health', gurmukhi: 'ਬੁਖ਼ਾਰ', roman: 'bukhaar', english: 'fever', pos: 'noun', gender: 'm' },
    { id: 'body-health-khangh', topic: 'body-health', gurmukhi: 'ਖੰਘ', roman: 'khangh', english: 'cough', pos: 'noun', gender: 'f' },
    { id: 'body-health-davai', topic: 'body-health', gurmukhi: 'ਦਵਾਈ', roman: 'davai', english: 'medicine', pos: 'noun', gender: 'f', accept: ['dawai'] },
    { id: 'body-health-bimaar', topic: 'body-health', gurmukhi: 'ਬਿਮਾਰ', roman: 'bimaar', english: 'sick, unwell', pos: 'adjective' },
    { id: 'body-health-theek', topic: 'body-health', gurmukhi: 'ਠੀਕ', roman: 'theek', english: 'fine; well; right', pos: 'adjective' },
    { id: 'body-health-araam', topic: 'body-health', gurmukhi: 'ਆਰਾਮ', roman: 'araam', english: 'rest', pos: 'noun', gender: 'm', note: 'Araam karo: take some rest.' },
];

export default words;
