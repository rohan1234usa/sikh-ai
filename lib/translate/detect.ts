// Pure script detection shared by the client (the live "Detected:" hint under
// the input) and the API route (prompt tailoring — the server re-runs this and
// never trusts the client's answer). Only Gurmukhi is self-identifying; Latin
// script stays ambiguous between English and romanized Punjabi, and that call
// is left to the model.

const GURMUKHI_CHAR = /[਀-੿]/; // Unicode Gurmukhi block
const LETTER = /\p{L}/u;

// Function words and verb forms that appear in romanized Punjabi sentences but
// not in English. Deliberately excludes borrowed nouns (langar, Waheguru,
// gurdwara, ardaas): those turn up constantly in English sentences about Sikhi
// ("I love langar"), which is precisely the false positive to avoid.
//
// Used only to keep Cloud Translation away from input it cannot handle — it
// has no romanized-Punjabi language code, so it will confidently mislabel such
// text as English and translate it into nonsense. Erring toward "this is
// Punjabi" costs the user a fallback they would not have wanted anyway.
const ROMANIZED_MARKERS = new Set([
    'haan', 'hain', 'tusi', 'tuhada', 'tuhanu', 'mainu', 'sanu', 'asin',
    'kiven', 'kive', 'kinna', 'kithe', 'kadon', 'jehra', 'ohna', 'ohda', 'ehna',
    'nahi', 'nahin', 'vich', 'vichon', 'kujh', 'thorhi', 'chahida',
    'kehnde', 'hunda', 'hundi', 'karda', 'kardi', 'karde', 'karo',
    'gaya', 'gayi', 'riha', 'rahi', 'layi', 'dasso', 'chalo', 'theek',
]);

// A single marker is enough: these words do not occur in English, so one hit is
// strong evidence, while requiring several would miss short phrases like
// "main theek haan" — the exact case this guards.
export function looksRomanizedPunjabi(text: string): boolean {
    for (const word of text.toLowerCase().split(/[^a-z]+/)) {
        if (word && ROMANIZED_MARKERS.has(word)) return true;
    }
    return false;
}

export function detectScript(text: string): 'gurmukhi' | 'latin' {
    let letters = 0;
    let gurmukhi = 0;
    for (const ch of text) {
        if (!LETTER.test(ch)) continue;
        letters++;
        if (GURMUKHI_CHAR.test(ch)) gurmukhi++;
    }
    // A ≥30% share of Gurmukhi letters counts as Gurmukhi input: mostly-Gurmukhi
    // text with Latin loanwords still detects correctly, while one quoted
    // Gurmukhi word inside a longer English sentence stays
    // Latin so the model classifies by the dominant language
    // ("what does ਧੰਨਵਾਦ mean?" scores 0.25 and stays Latin).
    return letters > 0 && gurmukhi / letters >= 0.3 ? 'gurmukhi' : 'latin';
}
