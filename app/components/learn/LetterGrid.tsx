import type { LetterCard } from '@/lib/learn/config';

// A row of the alphabet, a set of vowel signs, or the digits: the glyph
// large, then how it is written in English letters, its name, and how to
// say it. Five across on a wide screen, matching the painti's rows of five.
export default function LetterGrid({ letters, label }: { letters: LetterCard[]; label: string }) {
    return (
        <ul aria-label={label} className="grid grid-cols-2 min-[420px]:grid-cols-3 md:grid-cols-5 gap-2">
            {letters.map((letter, i) => (
                <li key={i} className="bg-surface-raised border border-edge rounded-xl p-3 text-center">
                    <span lang="pa" className="block font-gurmukhi text-4xl leading-tight text-ink">{letter.glyph}</span>
                    <span lang="pa-Latn" className="block font-bold text-accent-text">{letter.roman}</span>
                    <span lang="pa-Latn" className="block text-xs text-ink-faint">{letter.name}</span>
                    <span lang="en" className="block mt-1 text-xs text-ink-muted">{letter.sound}</span>
                </li>
            ))}
        </ul>
    );
}
