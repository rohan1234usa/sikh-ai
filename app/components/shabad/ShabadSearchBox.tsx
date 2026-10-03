'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { MagnifyingGlassIcon } from '@heroicons/react/24/outline';
import { alternativesOf, classifyQuery, MAX_QUERY_CHARS, type InvalidReason, type SearchAs } from '@/lib/gurbani/query';
import type { Dictionary } from '@/lib/i18n';
import { useLocalePath, useT } from '../../context/LanguageContext';
import { searchString, showSearch, useSearchQuery } from './useSearchQuery';

// Why a query can't be searched, in the reader's language.
export function invalidMessage(t: Dictionary, reason: InvalidReason): string {
    switch (reason) {
        case 'ang-range': return t.shabad.angRange;
        case 'too-long': return t.shabad.invalid.tooLong;
        case 'too-short': return t.shabad.invalid.tooShort;
        case 'english': return t.shabad.invalid.english;
        case 'unsupported-script': return t.shabad.invalid.otherScript;
        case 'empty':
        case 'no-letters': return t.shabad.invalid.noLetters;
    }
}

type Problem = { text: string; q: string; offer: SearchAs | null };

// The search box at the top of /shabad, of every Ang's page and of every
// shabad's page. A number opens that Ang; anything else is a verse search,
// shown under the box on /shabad (VerseResults) and taken there from the
// other pages. Without JavaScript the form still asks for /shabad?q=….
export default function ShabadSearchBox({ initial, inline }: { initial?: string; inline: boolean }) {
    const t = useT();
    const to = useLocalePath();
    const router = useRouter();
    const url = useSearchQuery();
    // On /shabad the box shows the search on show; it starts again whenever
    // that changes (an example, a "search … instead").
    const shown = inline ? url?.q : undefined;
    const [edited, setEdited] = useState<string | null>(null);
    const [problem, setProblem] = useState<Problem | null>(null);
    const [seen, setSeen] = useState(shown);
    if (shown !== seen) {
        setSeen(shown);
        setEdited(null);
        setProblem(null);
    }
    const value = edited ?? shown ?? initial ?? '';

    const search = (q: string, as?: SearchAs) => {
        setProblem(null);
        if (inline) showSearch(to('/shabad'), { q, as });
        else router.push(to(`/shabad${searchString({ q, as })}`));
        // On a phone, the keyboard would cover the results.
        if (window.matchMedia('(pointer: coarse)').matches && document.activeElement instanceof HTMLElement) document.activeElement.blur();
    };

    const submit = (e: React.FormEvent) => {
        e.preventDefault();
        const q = value.replace(/\s+/g, ' ').trim();
        if (!q) return;
        const query = classifyQuery(q);
        if (query.kind === 'ang') {
            setProblem(null);
            router.push(to(`/shabad/${query.ang}`));
        } else if (query.kind === 'invalid') {
            setProblem({ text: invalidMessage(t, query.reason), q, offer: alternativesOf(query)[0] ?? null });
        } else {
            search(q);
        }
    };

    return (
        <>
            <form role="search" action={to('/shabad')} method="get" onSubmit={submit} className="w-full max-w-xl relative">
                <input
                    type="search"
                    name="q"
                    aria-label={t.shabad.searchAria}
                    aria-invalid={problem ? true : undefined}
                    aria-describedby={problem ? 'shabad-search-error' : undefined}
                    value={value}
                    onChange={(e) => setEdited(e.target.value)}
                    placeholder={t.shabad.placeholder}
                    maxLength={MAX_QUERY_CHARS}
                    enterKeyHint="search"
                    autoComplete="off"
                    autoCapitalize="none"
                    autoCorrect="off"
                    spellCheck={false}
                    className="w-full p-4 pl-12 pr-16 sm:pr-28 rounded-xl text-navy bg-white border-2 border-transparent focus:border-kesri shadow-xl transition-all placeholder:text-slate-400 [&::-webkit-search-cancel-button]:hidden"
                />
                <MagnifyingGlassIcon className="w-6 h-6 text-slate-400 absolute left-4 top-1/2 -translate-y-1/2" aria-hidden="true" />
                <button
                    type="submit"
                    className="absolute right-2 top-2 bottom-2 bg-navy text-white px-4 sm:px-6 rounded-lg font-bold hover:bg-kesri hover:text-navy transition"
                >
                    <MagnifyingGlassIcon className="w-5 h-5 sm:hidden" aria-hidden="true" />
                    <span className="max-sm:sr-only">{t.shabad.searchButton}</span>
                </button>
            </form>
            {problem && (
                <p id="shabad-search-error" role="alert" className="mt-3 max-w-xl rounded-lg bg-red-50 px-4 py-2 text-sm font-medium text-red-700 dark:bg-red-950/60 dark:text-red-300">
                    {problem.text}
                    {problem.offer && (
                        <>
                            {' '}
                            <button type="button" onClick={() => search(problem.q, problem.offer ?? undefined)} className="font-semibold underline">
                                {problem.offer === 'words' ? t.shabad.invalid.searchWord : t.shabad.invalid.searchLetters}
                            </button>
                        </>
                    )}
                </p>
            )}
        </>
    );
}
