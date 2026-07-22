'use client';

import { useT } from '../../context/LanguageContext';
import type { PronunciationTip } from '@/lib/translate/config';

// Rows anchored to real words from the translation: the word (Gurmukhi over
// roman) on the left, the how-to-say-it tip on the right. Renders nothing
// when no sound in the text needs explaining.
export default function PronunciationTips({ tips }: { tips: PronunciationTip[] }) {
    const t = useT();
    if (tips.length === 0) return null;

    return (
        <section>
            <h2 className="text-ink font-bold mb-3">{t.translate.pronunciationHeading}</h2>
            <ul className="bg-surface-raised border border-edge rounded-xl divide-y divide-edge">
                {tips.map((tip, i) => (
                    <li key={i} className="flex items-start gap-4 p-4">
                        <div className="shrink-0 w-24 text-center">
                            <p lang="pa" className="font-gurmukhi text-xl text-ink leading-snug">{tip.gurmukhi}</p>
                            <p lang="pa-Latn" className="text-xs text-accent-text font-semibold">{tip.roman}</p>
                        </div>
                        {/* Explanations always come back in English (see lib/translate/prompts.ts) */}
                        <p lang="en" className="text-sm text-ink-muted leading-relaxed">{tip.tip}</p>
                    </li>
                ))}
            </ul>
        </section>
    );
}
