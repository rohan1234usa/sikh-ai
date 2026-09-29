'use client';

import { useState } from 'react';
import { ChevronDownIcon } from '@heroicons/react/24/outline';
import CopyButton from '@/app/components/translate/CopyButton';
import { useT } from '@/app/context/LanguageContext';
import { fmt } from '@/lib/i18n/fmt';
import type { VocabWord } from '@/lib/learn/config';
import ExampleRow from './ExampleRow';
import Mixed from './Mixed';

// A topic's words, the way the translator's phrasebook lists phrases:
// romanization and meaning at a glance, the Gurmukhi and the details a tap
// away.
export default function WordList({ words }: { words: VocabWord[] }) {
    const [open, setOpen] = useState<string | null>(null);
    return (
        <ul className="space-y-2">
            {words.map((word) => (
                <WordRow
                    key={word.id}
                    word={word}
                    expanded={open === word.id}
                    onToggle={() => setOpen((prev) => (prev === word.id ? null : word.id))}
                />
            ))}
        </ul>
    );
}

function WordRow({ word, expanded, onToggle }: { word: VocabWord; expanded: boolean; onToggle: () => void }) {
    const t = useT();
    const detailsId = `word-${word.id}`;
    const copyLabel = fmt(t.translate.copyAria, { label: t.translate.gurmukhiLabel });
    const grammar = [t.learn.partsOfSpeech[word.pos], word.gender ? t.learn.genders[word.gender] : null].filter(Boolean).join(' · ');

    return (
        <li className="rounded-xl border border-edge bg-surface-raised">
            <button
                type="button"
                onClick={onToggle}
                aria-expanded={expanded}
                aria-controls={detailsId}
                className="flex w-full items-center gap-3 px-4 py-3 text-left"
            >
                <span className="flex min-w-0 flex-1 flex-col sm:flex-row sm:items-center sm:gap-3">
                    <span lang="pa-Latn" className="truncate font-semibold text-ink">{word.roman}</span>
                    <span lang="en" className="truncate text-sm text-ink-muted"><Mixed text={word.english} /></span>
                </span>
                {/* Capped, so a long phrase can't squeeze out the romanization on a
                    phone; the open row shows it whole. */}
                <span lang="pa" className="min-w-0 max-w-[45%] truncate font-gurmukhi text-lg text-ink-muted">{word.gurmukhi}</span>
                <ChevronDownIcon
                    className={`h-4 w-4 shrink-0 text-ink-faint transition-transform ${expanded ? 'rotate-180' : ''}`}
                    aria-hidden="true"
                />
            </button>

            {expanded && (
                <div id={detailsId} className="space-y-3 border-t border-edge px-4 pb-4 pt-3">
                    <div className="flex items-start gap-3">
                        <div className="min-w-0 flex-1">
                            <p lang="pa" className="font-gurmukhi text-3xl leading-relaxed text-ink">{word.gurmukhi}</p>
                            <p lang="pa-Latn" className="font-medium text-ink">{word.roman}</p>
                            <p lang="en" className="text-sm text-ink-muted"><Mixed text={word.english} /></p>
                        </div>
                        <CopyButton text={word.gurmukhi} ariaLabel={copyLabel} />
                    </div>
                    <p className="inline-block rounded-full bg-edge/40 px-2.5 py-0.5 text-xs text-ink-muted">{grammar}</p>
                    {word.note && <p lang="en" className="rounded-lg bg-edge/30 p-3 text-sm text-ink-muted"><Mixed text={word.note} /></p>}
                    {word.example && (
                        <div className="space-y-1">
                            <p className="text-xs font-bold uppercase tracking-widest text-accent-text">{t.learn.vocab.example}</p>
                            <ExampleRow example={word.example} copyLabel={copyLabel} />
                        </div>
                    )}
                </div>
            )}
        </li>
    );
}
