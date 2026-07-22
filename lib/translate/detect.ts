// Pure script detection shared by the client (the live "Detected:" hint under
// the input) and the API route (prompt tailoring — the server re-runs this and
// never trusts the client's answer). Only Gurmukhi is self-identifying; Latin
// script stays ambiguous between English and romanized Punjabi, and that call
// is left to the model.

const GURMUKHI_CHAR = /[਀-੿]/; // Unicode Gurmukhi block
const LETTER = /\p{L}/u;

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
