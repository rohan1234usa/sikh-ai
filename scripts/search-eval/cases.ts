// The searches npm run eval:search puts to the live verse search: well-known
// lines typed the ways readers type them, and things that should find
// nothing. Gurmukhi inputs are cut from the live source by a rule, from a
// line pinned by its id, never typed here; romanized ones are typed as
// readers type them. Each names what a right answer is.

export type Tag =
    | 'gurmukhi'       // a line, as GurbaniNow spells it
    | 'gurmukhi-loose' // …without vowel signs
    | 'gurmukhi-part'  // …its first words
    | 'gurmukhi-typo'  // …with a typo
    | 'letters'        // its first letters in Gurmukhi
    | 'roman-source'   // GurbaniNow's transliteration
    | 'roman-casual'   // English letters, the way readers write them
    | 'roman-letters'  // the first letters in English
    | 'negative'       // nothing in Sri Guru Granth Sahib Ji to find
    | 'ang';           // an Ang number

import type { Make } from '../../tests/gurbani/search-fixtures';

export type EvalCase = {
    id: string;
    tag: Tag;
    input?: string;
    from?: { ang: number; lineId: string; make: Make };
    // A right answer: this line (or the same words in an earlier shabad), on
    // this Ang; `none` for the negatives; `angPage` for an Ang number.
    expect: { lineId?: string; ang?: number; none?: true; angPage?: number };
};

const line = (id: string, ang: number, lineId: string, make: Make, tag: Tag): EvalCase =>
    ({ id, tag, from: { ang, lineId, make }, expect: { lineId, ang } });
const typed = (id: string, tag: Tag, input: string, ang: number, lineId?: string): EvalCase =>
    ({ id, tag, input, expect: { ang, ...(lineId ? { lineId } : {}) } });

export const CASES: EvalCase[] = [
    // Gurmukhi, as the source spells it.
    line('anand-line', 917, '2UEB', 'line', 'gurmukhi'),
    line('man-tu-line', 441, '9H5T', 'line', 'gurmukhi'),
    line('pavan-line', 8, '62FB', 'line', 'gurmukhi'),
    line('hukam-line', 1, 'H0PC', 'line', 'gurmukhi'),
    line('koi-bole-line', 885, '7PXE', 'line', 'gurmukhi'),
    line('haumai-line', 466, '8D52', 'line', 'gurmukhi'),
    // …without vowel signs, its first words, with a typo.
    line('mera-baid-loose', 618, 'JLAS', 'loose', 'gurmukhi-loose'),
    line('simran-loose', 263, 'EJU0', 'loose', 'gurmukhi-loose'),
    line('jap-tap-loose', 729, 'C70F', 'loose', 'gurmukhi-loose'),
    line('sochai-loose', 1, 'BL70', 'loose', 'gurmukhi-loose'),
    line('anand-part', 917, '2UEB', 'words:0-3', 'gurmukhi-part'),
    line('man-tu-part', 441, '9H5T', 'words:0-3', 'gurmukhi-part'),
    line('jai-ghar-part', 12, 'ZGW1', 'words:0-3', 'gurmukhi-part'),
    line('tati-vao-typo', 819, 'D7PD', 'swap', 'gurmukhi-typo'),
    line('jo-mange-typo', 681, 'NGMS', 'swap', 'gurmukhi-typo'),
    // First letters.
    line('anand-letters', 917, '2UEB', 'letters', 'letters'),
    line('man-tu-letters', 441, '9H5T', 'letters', 'letters'),
    line('pavan-spaced', 8, '62FB', 'spaced-letters', 'letters'),
    line('haumai-vowels', 466, '8D52', 'letters-raw', 'letters'),
    // GurbaniNow's own transliteration.
    line('anand-source', 917, '2UEB', 'roman', 'roman-source'),
    line('man-tu-source', 441, '9H5T', 'roman', 'roman-source'),
    line('pavan-source', 8, '62FB', 'roman', 'roman-source'),
    line('hukam-source', 1, 'H0PC', 'roman', 'roman-source'),
    line('koi-bole-source', 885, '7PXE', 'roman', 'roman-source'),
    // The way readers write them.
    typed('so-purakh', 'roman-casual', 'so purakh niranjan', 10, '546S'),
    typed('tu-thakur', 'roman-casual', 'tu thakur tum peh ardas', 268, 'Y99N'),
    typed('ik-onkar', 'roman-casual', 'ik onkar satnam karta purakh', 1, '0NVY'),
    typed('aad-sach', 'roman-casual', 'aad sach jugaad sach', 1, 'J92N'),
    typed('hukam', 'roman-casual', 'hukam rajai chalna nanak likhia naal', 1, 'H0PC'),
    typed('sochai', 'roman-casual', 'sochai soch na hovai je sochi lakh vaar', 1, 'BL70'),
    typed('pavan', 'roman-casual', 'pavan guru pani pita mata dharat mahat', 8, '62FB'),
    typed('jo-mange', 'roman-casual', 'jo mange thakur apne te soi soi deve', 681, 'NGMS'),
    typed('mera-baid', 'roman-casual', 'mera baid guru govinda', 618, 'JLAS'),
    typed('tati-vao', 'roman-casual', 'tati vao na lagai parbrahm sarnai', 819, 'D7PD'),
    typed('dhan-dhan', 'roman-casual', 'dhan dhan ram das gur', 968, 'YLSG'),
    typed('koi-bole', 'roman-casual', 'koi bole ram ram koi khudai', 885, '7PXE'),
    typed('tera-kiya', 'roman-casual', 'tera kiya meetha laage', 394, '2GYN'),
    typed('haumai', 'roman-casual', 'haumai deeragh rog hai daru bhi is mahe', 466, '8D52'),
    typed('man-tu', 'roman-casual', 'man tu jot saroop hai apna mool pachhan', 441, '9H5T'),
    typed('anand', 'roman-casual', 'anand bhaya meri maye satguru mai paya', 917, '2UEB'),
    typed('jap-tap', 'roman-casual', 'jap tap ka bandh berhula jit langhe vahela', 729, 'C70F'),
    typed('jai-ghar', 'roman-casual', 'jai ghar keerat aakhiai karte ka hoe beecharo', 12, 'ZGW1'),
    // First letters in English.
    typed('spnh', 'roman-letters', 'spnh', 10, '546S'),
    typed('spnh-spaced', 'roman-letters', 's p n h', 10, '546S'),
    typed('asjs', 'roman-letters', 'asjs', 1, 'J92N'),
    typed('mbgg', 'roman-letters', 'mbgg', 618, 'JLAS'),
    // Nothing to find.
    { id: 'shepherd', tag: 'negative', input: 'the lord is my shepherd', expect: { none: true } },
    { id: 'question', tag: 'negative', input: 'what does japji sahib mean', expect: { none: true } },
    { id: 'gibberish', tag: 'negative', input: 'asdf qwer zxcv', expect: { none: true } },
    { id: 'hello', tag: 'negative', input: 'hello how are you doing today', expect: { none: true } },
    { id: 'ardas', tag: 'negative', input: 'nanak naam chardi kala tere bhane sarbat da bhala', expect: { none: true } },
    { id: 'deh-shiva', tag: 'negative', input: 'deh shiva bar mohe ihai shubh karman te kabhu na taro', expect: { none: true } },
    { id: 'mitar-pyare', tag: 'negative', input: 'mitar pyare nu haal mureedan da kehna', expect: { none: true } },
    { id: 'devanagari', tag: 'negative', input: 'सो पुरखु निरंजनु', expect: { none: true } },
    // Ang numbers open the Ang.
    { id: 'ang-last', tag: 'ang', input: '1430', expect: { angPage: 1430 } },
    { id: 'ang-gurmukhi', tag: 'ang', input: '੧੪੩੦', expect: { angPage: 1430 } },
    { id: 'ang-word', tag: 'ang', input: 'ang 5', expect: { angPage: 5 } },
];
