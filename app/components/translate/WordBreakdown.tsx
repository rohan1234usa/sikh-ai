'use client';

import { useT } from '../../context/LanguageContext';
import type { WordGloss } from '@/lib/translate/config';

// Flex-wrap grid of gloss cards, one per source word or phrase, in source
// order. Cards wrap naturally on mobile — no table, no horizontal scroll.
export default function WordBreakdown({ words }: { words: WordGloss[] }) {
    const t = useT();
    if (words.length === 0) return null;

    return (
        <section>
            <h2 className="text-ink font-bold mb-3">{t.translate.wordByWord}</h2>
            <ul className="flex flex-wrap gap-2">
                {words.map((w, i) => (
                    <li key={i} className="bg-surface-raised border border-edge rounded-lg px-3 py-2 max-w-full">
                        <p lang="pa" className="font-gurmukhi text-lg text-ink leading-snug">{w.gurmukhi}</p>
                        <p lang="pa-Latn" className="text-xs text-accent-text font-semibold">{w.roman}</p>
                        {/* Explanations always come back in English (see lib/translate/prompts.ts) */}
                        <p lang="en" className="text-xs text-ink-muted mt-0.5">{w.meaning}</p>
                    </li>
                ))}
            </ul>
        </section>
    );
}
