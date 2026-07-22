'use client';

import { useMemo, useState } from 'react';
import { MagnifyingGlassIcon, ChevronDownIcon } from '@heroicons/react/24/outline';
import { useT } from '../../context/LanguageContext';
import { fmt } from '@/lib/i18n/fmt';
import {
    PHRASE_CATEGORIES,
    searchPhrases,
    type Phrase,
    type PhraseCategoryId,
} from '@/lib/translate/phrasebook';
import CopyButton from './CopyButton';

type Props = {
    onUsePhrase: (phrase: Phrase) => void;
};

export default function Phrasebook({ onUsePhrase }: Props) {
    const t = useT();
    const [query, setQuery] = useState('');
    const [category, setCategory] = useState<PhraseCategoryId>('greetings');
    const [expandedId, setExpandedId] = useState<string | null>(null);

    // A search spans every category, so the pills hide while one is active.
    const searching = query.trim() !== '';
    const phrases = useMemo(() => searchPhrases(query, category), [query, category]);

    return (
        <section>
            <h2 className="text-ink font-bold">{t.translate.phrasebookTitle}</h2>
            <p className="text-sm text-ink-muted">{t.translate.phrasebookSubtitle}</p>
            <p className="text-xs text-ink-faint italic mt-1 mb-4">{t.translate.phrasebookCaveat}</p>

            <div className="relative mb-3">
                <MagnifyingGlassIcon className="w-4 h-4 text-ink-faint absolute left-3 top-1/2 -translate-y-1/2" aria-hidden="true" />
                <input
                    type="search"
                    aria-label={t.translate.phrasebookSearchAria}
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder={t.translate.phrasebookSearchPlaceholder}
                    className="w-full py-2 pl-9 pr-3 rounded-lg bg-surface-raised border border-edge text-ink placeholder:text-ink-faint focus:border-kesri outline-none transition-colors"
                />
            </div>

            {!searching && (
                <div role="group" aria-label={t.translate.phrasebookTitle} className="flex flex-wrap gap-2 mb-4">
                    {PHRASE_CATEGORIES.map(id => (
                        <button
                            key={id}
                            type="button"
                            onClick={() => setCategory(id)}
                            aria-pressed={category === id}
                            className={`px-3 py-1 rounded-full text-sm transition-colors border ${category === id
                                ? 'bg-navy text-white border-navy font-semibold'
                                : 'bg-surface-raised text-ink-muted border-edge hover:text-ink'}`}
                        >
                            {t.translate.categories[id]}
                        </button>
                    ))}
                </div>
            )}

            {phrases.length === 0 ? (
                <p className="text-sm text-ink-muted py-6 text-center">{t.translate.phrasebookNoResults}</p>
            ) : (
                <ul className="space-y-2">
                    {phrases.map(phrase => (
                        <PhraseRow
                            key={phrase.id}
                            phrase={phrase}
                            expanded={expandedId === phrase.id}
                            showCategory={searching}
                            onToggle={() => setExpandedId(prev => (prev === phrase.id ? null : phrase.id))}
                            onUse={() => onUsePhrase(phrase)}
                        />
                    ))}
                </ul>
            )}
        </section>
    );
}

function PhraseRow({ phrase, expanded, showCategory, onToggle, onUse }: {
    phrase: Phrase;
    expanded: boolean;
    showCategory: boolean; // search spans every category, so rows label themselves
    onToggle: () => void;
    onUse: () => void;
}) {
    const t = useT();
    const detailsId = `phrase-details-${phrase.id}`;

    return (
        <li className="bg-surface-raised border border-edge rounded-xl">
            <button
                type="button"
                onClick={onToggle}
                aria-expanded={expanded}
                aria-controls={detailsId}
                className="w-full flex items-center gap-3 px-4 py-3 text-left"
            >
                {/* No aria-label: the visible roman + English becomes the accessible
                    name, so rows stay distinguishable in a screen-reader list. */}
                {/* Stacked on mobile so long phrases truncate instead of overflowing */}
                <span className="flex-1 min-w-0 flex flex-col sm:flex-row sm:items-center sm:gap-3">
                    <span lang="pa-Latn" className="text-ink font-semibold truncate">{phrase.roman}</span>
                    <span lang="en" className="text-sm text-ink-muted truncate">{phrase.english}</span>
                </span>
                {showCategory && (
                    <span className="hidden sm:inline shrink-0 text-xs text-ink-faint">
                        {t.translate.categories[phrase.category]}
                    </span>
                )}
                <ChevronDownIcon
                    className={`w-4 h-4 text-ink-faint shrink-0 transition-transform ${expanded ? 'rotate-180' : ''}`}
                    aria-hidden="true"
                />
            </button>

            {expanded && (
                <div id={detailsId} className="px-4 pb-4 pt-3 border-t border-edge space-y-2">
                    <p lang="pa" className="font-gurmukhi text-2xl text-ink leading-relaxed">{phrase.gurmukhi}</p>
                    <p lang="pa-Latn" className="text-ink">{phrase.roman}</p>
                    <p lang="en" className="text-sm text-ink-muted">{phrase.english}</p>
                    {phrase.note && (
                        <p className="text-sm text-ink-muted bg-edge/30 rounded-lg p-3">
                            <span className="font-semibold text-accent-text">{t.translate.culturalNote}: </span>
                            {/* Notes are authored in English only (see lib/translate/phrasebook.ts) */}
                            <span lang="en">{phrase.note}</span>
                        </p>
                    )}
                    <div className="flex items-center gap-2 pt-1">
                        <button
                            type="button"
                            onClick={onUse}
                            className="text-sm font-semibold text-accent-text hover:underline"
                        >
                            {t.translate.usePhrase}
                        </button>
                        <CopyButton
                            text={phrase.gurmukhi}
                            ariaLabel={fmt(t.translate.copyAria, { label: t.translate.gurmukhiLabel })}
                        />
                    </div>
                </div>
            )}
        </li>
    );
}
