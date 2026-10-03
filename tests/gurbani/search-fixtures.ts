// The searches the verse-search tests replay: what a reader might type. The
// Gurmukhi inputs are cut from recorded lines by a `make` rule, never typed
// here; the romanized ones are typed as readers type them.
//
// `npm run fixtures:gurbani -- --only search` runs each through the real
// search (lib/gurbani/search.ts) against GurbaniNow and records every lookup
// it makes in fixtures/search.json. Relative imports only: the recorder
// loads this file.

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { GurbaniLine } from '../../lib/gurbani/gurbaninow';
import { firstLetters } from '../../lib/gurbani/gurmukhi';
import { romanTokens } from '../../lib/gurbani/roman';
import { lineKeys, toSearchLetters } from '../../lib/gurbani/score';

export type Make =
    | 'line'            // the line as GurbaniNow spells it
    | 'standard'        // …with subjoined letters as standard Unicode writes them (੍ਹ), as readers type
    | 'loose'           // …with no vowel signs, tippi, bindi or addak
    | 'swap'            // …with a typo: its longest word's last letter changed
    | `words:${number}-${number}` // a run of its words
    | 'letters'         // its first letters, run together
    | 'letters-raw'     // …with vowels typed as themselves (ਇ, not ੲ)
    | 'spaced-letters'  // …spaced out
    | 'roman'           // GurbaniNow's transliteration
    | 'roman-casual'    // …spelled the way readers do: long vowels once, retroflex letters single
    | 'roman-letters';  // the first letter of each transliterated word

export type SearchFixture = { id: string; input?: string; from?: string; make?: Make; as?: 'words' | 'letters' };

export const SEARCHES: SearchFixture[] = [
    // Japji: a refrain, and the Mool Mantar, which opens dozens of shabads.
    { id: 'refrain-line', from: 'J92N', make: 'line' },
    { id: 'refrain-letters', from: 'J92N', make: 'letters' },
    { id: 'refrain-casual', from: 'J92N', make: 'roman-casual' },
    { id: 'mool-mantar-letters', from: '0NVY', make: 'letters' },
    { id: 'mool-mantar-roman', from: '0NVY', make: 'roman' },
    // Lines GurbaniNow spells with the udaat sign, typed the standard way.
    { id: 'udaat-rahao', from: '4ZD2', make: 'standard' },
    { id: 'udaat-salok', from: 'CHF5', make: 'standard' },
    // Sukhmani: many lines start alike.
    { id: 'sukhmani-start', from: 'YD0U', make: 'words:0-3' },
    { id: 'sukhmani-line', from: 'U1MK', make: 'line' },
    // Asa di Vaar and Ang 394: typed loosely, with a typo, letter by letter.
    { id: 'loose-line', from: 'ARGD', make: 'loose' },
    { id: 'typo-line', from: 'SA7X', make: 'swap' },
    { id: 'typo-short', from: 'JHEL', make: 'swap' },
    { id: 'spaced-letters', from: '3QT1', make: 'spaced-letters' },
    { id: 'roman-initials', from: '62ZU', make: 'roman-letters' },
    // A line of Sri Dasam Granth: not searched, so not found.
    { id: 'dasam-line', from: 'JKBQ', make: 'line' },
    { id: 'dasam-roman', from: 'JKBQ', make: 'roman-casual' },
    // Typed the way readers type them.
    { id: 'so-purakh', input: 'so purakh niranjan' },
    { id: 'tu-thakur', input: 'tu thakur tum peh ardas' },
    { id: 'thu-thakur', input: 'thu thakur thum peh ardaas' },
    { id: 'ik-onkar', input: 'ik onkar satnam karta purakh' },
    { id: 'spnh', input: 'spnh' },
    { id: 'spnh-spaced', input: 's p n h' },
    { id: 'tera-kiya', input: 'tera kiya meetha laage' },
    { id: 'mera-baid', input: 'mera baid guru govinda' },
    { id: 'tati-vao', input: 'tati vao na lagai' },
    { id: 'dhan-dhan', input: 'dhan dhan ram das gur' },
    { id: 'jo-mange', input: 'jo mange thakur apne te soi soi deve' },
    { id: 'shepherd', input: 'the lord is my shepherd' },
    { id: 'gibberish', input: 'asdf qwer zxcv' },
];

const PAGES: Record<string, GurbaniLine[]> = JSON.parse(readFileSync(resolve(import.meta.dirname, 'fixtures/gurbaninow.json'), 'utf8'));
const RECORDED = new Map(Object.values(PAGES).flat().map(line => [line.id, line]));

export function sourceLine(fixture: SearchFixture): GurbaniLine | undefined {
    if (!fixture.from) return undefined;
    const line = RECORDED.get(fixture.from);
    if (!line) throw new Error(`no recorded line ${fixture.from} for search fixture ${fixture.id}`);
    return line;
}

export const casual = (text: string) => text.toLowerCase()
    .replace(/aa/g, 'a').replace(/ee/g, 'i').replace(/oo/g, 'u').replace(/tth/g, 'th').replace(/tt/g, 't').replace(/dd/g, 'd').replace(/rr/g, 'r');

const standard = (text: string) => text.replace(/ੑ/g, '੍ਹ').replace(/ੵ/g, '੍ਯ');
const loose = (text: string) => text.replace(/[ਁਂ਼ਾ-੍ੑੰੱੵ]/g, '');

// A typo: the longest word's last letter swapped for the one before it in
// the alphabet's code chart (ਖ for ਗ, ਕ for ਖ).
function swap(line: GurbaniLine): string {
    const words = lineKeys(line.gurmukhi).raw;
    const longest = words.reduce((best, w, i) => ([...w].length > [...words[best]].length ? i : best), 0);
    const word = [...words[longest]];
    const at = word.findLastIndex(ch => /[ਕ-ਹ]/.test(ch));
    word[at] = String.fromCharCode(word[at].charCodeAt(0) - 1);
    return words.map((w, i) => (i === longest ? word.join('') : w)).join(' ');
}

export function inputOf(fixture: SearchFixture): string {
    if (fixture.input !== undefined) return fixture.input;
    return makeInput(sourceLine(fixture)!, fixture.make ?? 'line');
}

// A line, typed by one of the rules above. npm run eval:search uses these
// too, on lines from the live source.
export function makeInput(line: GurbaniLine, make: Make): string {
    if (make.startsWith('words:')) {
        const [from, to] = make.slice('words:'.length).split('-').map(Number);
        return lineKeys(line.gurmukhi).raw.slice(from, to).join(' ');
    }
    switch (make) {
        case 'line': return line.gurmukhi;
        case 'standard': return standard(line.gurmukhi);
        case 'loose': return loose(lineKeys(line.gurmukhi).raw.join(' '));
        case 'swap': return swap(line);
        case 'letters': return toSearchLetters(firstLetters(line.gurmukhi));
        case 'letters-raw': return firstLetters(line.gurmukhi);
        case 'spaced-letters': return [...toSearchLetters(firstLetters(line.gurmukhi))].join(' ');
        case 'roman': return line.transliteration;
        case 'roman-casual': return casual(line.transliteration);
        case 'roman-letters': return romanTokens(line.transliteration).map(word => word[0]).join(' ');
    }
    throw new Error(`unknown make ${make}`);
}
