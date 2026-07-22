'use client';

import { useT } from '../../context/LanguageContext';
import type { TranslationNote } from '@/lib/translate/config';

// Stacked note cards (≤4 per result, so no accordion needed). Renders
// nothing when the model correctly returned no notes for simple text.
export default function TrickyNotes({ notes }: { notes: TranslationNote[] }) {
    const t = useT();
    if (notes.length === 0) return null;

    return (
        <section>
            <h2 className="text-ink font-bold mb-3">{t.translate.notesHeading}</h2>
            <div className="space-y-3">
                {notes.map((note, i) => (
                    <div key={i} className="bg-surface-raised border border-edge rounded-xl p-4">
                        <p className="text-xs uppercase tracking-widest text-accent-text font-bold mb-1">
                            {t.translate.noteKinds[note.kind]}
                        </p>
                        {/* Explanations always come back in English (see lib/translate/prompts.ts) */}
                        <p lang="en" className="text-ink font-semibold mb-1">{note.title}</p>
                        <p lang="en" className="text-sm text-ink-muted leading-relaxed">{note.body}</p>
                    </div>
                ))}
            </div>
        </section>
    );
}
