'use client';

import { useState } from 'react';
import { XMarkIcon } from '@heroicons/react/24/outline';
import { useT } from '../../context/LanguageContext';
import { fmt } from '@/lib/i18n/fmt';
import type { IdentifyHistoryEntry } from './useIdentifyHistory';

type Props = {
    entries: IdentifyHistoryEntry[];
    hydrated: boolean;
    onSelect: (entry: IdentifyHistoryEntry) => void;
    onRemove: (id: string) => void;
    onClear: () => void;
};

// Presentational list over useIdentifyHistory (the hook lives in the page so
// `add` sits next to the fetch). Hidden entirely until hydration and while
// empty — the section simply doesn't exist yet.
export default function IdentifyHistory({ entries, hydrated, onSelect, onRemove, onClear }: Props) {
    const t = useT();
    const [confirming, setConfirming] = useState(false);

    if (!hydrated || entries.length === 0) return null;

    return (
        <section>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mb-3">
                <h2 className="text-ink font-bold">{t.identify.historyTitle}</h2>
                <div className="ml-auto flex items-center gap-2 text-sm">
                    {confirming ? (
                        <>
                            <span className="text-ink-muted">{t.identify.historyClearPrompt}</span>
                            <button
                                type="button"
                                onClick={() => { onClear(); setConfirming(false); }}
                                className="font-semibold text-red-600 dark:text-red-400 hover:underline"
                            >
                                {t.identify.historyClearConfirm}
                            </button>
                            <button
                                type="button"
                                onClick={() => setConfirming(false)}
                                className="text-ink-faint hover:text-ink hover:underline"
                            >
                                {t.identify.cancel}
                            </button>
                        </>
                    ) : (
                        <button
                            type="button"
                            onClick={() => setConfirming(true)}
                            className="text-ink-faint hover:text-ink hover:underline"
                        >
                            {t.identify.historyClear}
                        </button>
                    )}
                </div>
            </div>

            <ul className="max-h-72 overflow-y-auto space-y-1">
                {entries.map(entry => {
                    const top = entry.result.matches[0];
                    return (
                        <li key={entry.id} className="flex items-center gap-1">
                            {/* No aria-label: without it the row's own text becomes
                                the accessible name, so entries stay distinguishable
                                in a screen-reader list instead of all reading alike. */}
                            <button
                                type="button"
                                onClick={() => onSelect(entry)}
                                className="flex-1 min-w-0 text-left rounded-lg px-3 py-2 hover:bg-edge/40 transition-colors"
                            >
                                <span lang="pa" className="block truncate text-sm text-ink font-gurmukhi">
                                    {top.verse.gurmukhi}
                                </span>
                                <span className="block truncate text-xs text-ink-faint">
                                    {top.ang === null ? t.identify.angUnknown : fmt(t.identify.ang, { n: top.ang })}
                                </span>
                            </button>
                            <button
                                type="button"
                                onClick={() => onRemove(entry.id)}
                                aria-label={fmt(t.identify.historyRemoveAria, { text: top.verse.gurmukhi })}
                                className="p-1.5 rounded-lg text-ink-faint hover:text-ink hover:bg-edge/60 transition-colors"
                            >
                                <XMarkIcon className="w-4 h-4" aria-hidden="true" />
                            </button>
                        </li>
                    );
                })}
            </ul>
        </section>
    );
}
