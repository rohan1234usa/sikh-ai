'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
    canonicalQuery, classifyQuery, isSearchable, sanitizeVerseSearch, SEARCH_EXAMPLES, type VerseSearchResponse,
} from '@/lib/gurbani/query';
import { responseErrorText } from '@/lib/i18n/apiError';
import { fmt } from '@/lib/i18n/fmt';
import { useLocalePath, useT } from '../../context/LanguageContext';
import { invalidMessage } from './ShabadSearchBox';
import { searchString, showSearch, useSearchQuery } from './useSearchQuery';
import VerseResultCard from './VerseResultCard';

type Answer = { ok: true; data: VerseSearchResponse } | { ok: false; message: string };

// Complete answers already fetched on this visit, so Back from a shabad
// shows its search at once, scrolled where it was. The oldest go first.
const answered = new Map<string, VerseSearchResponse>();
const MAX_REMEMBERED = 30;
function remember(key: string, data: VerseSearchResponse) {
    answered.delete(key);
    answered.set(key, data);
    if (answered.size > MAX_REMEMBERED) answered.delete(answered.keys().next().value as string);
}

const PANEL = 'max-w-4xl mx-auto w-full px-4 sm:px-6 py-6';

// The verse search's results, under the box on /shabad: what the address
// (?q=) asks for, fetched from /api/shabad/search.
export default function VerseResults() {
    const t = useT();
    const to = useLocalePath();
    const router = useRouter();
    const url = useSearchQuery();
    const query = url?.q ? classifyQuery(url.q, url.as) : null;
    // One spelling per search, so the CDN keeps one copy of each answer.
    const key = url && query && isSearchable(query) ? `/api/shabad/search${searchString({ q: canonicalQuery(url.q), as: url.as })}` : null;
    // One asking of that search: searching again, or Try again, asks afresh
    // unless a complete answer is already in hand.
    const [attempt, setAttempt] = useState(0);
    const asking = key && url ? `${key} ${url.submission} ${attempt}` : null;
    const [latest, setLatest] = useState<{ asking: string; answer: Answer } | null>(null);
    const remembered = key ? answered.get(key) : undefined;
    const answer: Answer | undefined = remembered ? { ok: true, data: remembered } : latest?.asking === asking ? latest.answer : undefined;

    // /shabad?q=10, from the search box without JavaScript: that Ang's page.
    const ang = query?.kind === 'ang' ? query.ang : null;
    useEffect(() => {
        if (ang !== null) router.replace(to(`/shabad/${ang}`));
    }, [ang, router, to]);

    useEffect(() => {
        if (!key || !asking || answered.has(key)) return;
        const controller = new AbortController();
        fetch(key, { signal: controller.signal })
            .then(async (res) => {
                const data = await res.json().catch(() => null);
                const found = res.ok ? sanitizeVerseSearch(data) : null;
                if (found) {
                    // An incomplete answer is asked for afresh next time.
                    if (found.complete) remember(key, found);
                    setLatest({ asking, answer: { ok: true, data: found } });
                } else {
                    setLatest({ asking, answer: { ok: false, message: res.ok ? t.errors.generic : responseErrorText(t, res, data, 'search_busy') } });
                }
            })
            .catch(() => {
                if (!controller.signal.aborted) setLatest({ asking, answer: { ok: false, message: t.errors.source_error } });
            });
        return () => controller.abort();
    }, [key, asking, t]);

    const retry = () => setAttempt((n) => n + 1);
    const searchAs = (as: 'words' | 'letters') => url && showSearch(to('/shabad'), { q: url.q, as });

    // Before the page knows its address, and on its way to an Ang.
    if (!url || ang !== null) return null;

    if (!url.q) {
        return (
            <div className={PANEL}>
                <p className="text-sm font-semibold text-ink-muted">{t.shabad.results.examples}</p>
                <ul className="mt-2 flex flex-wrap gap-2">
                    {[SEARCH_EXAMPLES.words, SEARCH_EXAMPLES.letters, SEARCH_EXAMPLES.roman].map((example) => {
                        const latin = /[a-z]/.test(example);
                        return (
                            <li key={example}>
                                <button
                                    type="button"
                                    onClick={() => showSearch(to('/shabad'), { q: example })}
                                    lang={latin ? 'pa-Latn' : 'pa'}
                                    className={`rounded-full border border-edge bg-surface-raised px-4 py-1.5 text-ink shadow-sm transition-colors hover:border-kesri/60 ${latin ? 'text-sm' : 'font-gurmukhi text-lg'}`}
                                >
                                    {example}
                                </button>
                            </li>
                        );
                    })}
                </ul>
            </div>
        );
    }

    if (!query || !isSearchable(query)) {
        return (
            <div className={PANEL}>
                <p role="alert" className="rounded-lg bg-red-50 px-4 py-3 text-sm font-medium text-red-700 dark:bg-red-950/60 dark:text-red-300">
                    {query?.kind === 'invalid' ? invalidMessage(t, query.reason) : t.shabad.invalid.noLetters}
                </p>
            </div>
        );
    }

    const data = answer?.ok ? answer.data : null;
    // "Nothing matched" only when every lookup was answered.
    const status = !answer ? t.shabad.results.searching
        : !answer.ok ? answer.message
        : data && data.hits.length > 0 ? fmt(t.shabad.results.found, { n: data.hits.length })
        : data?.complete ? t.shabad.results.none
        : t.shabad.results.unfinished;

    return (
        <section aria-labelledby="verse-results-heading" aria-busy={!answer} className={`${PANEL} space-y-4`}>
            <p role="status" className="sr-only">{status}</p>

            {!answer && (
                <ol aria-hidden="true" className="space-y-3">
                    {[0, 1, 2].map((i) => (
                        <li key={i} className="rounded-xl border border-edge bg-surface-raised p-4 sm:p-6 shadow-sm animate-pulse space-y-3">
                            <div className="h-7 w-3/4 rounded bg-edge/60" />
                            <div className="h-4 w-1/2 rounded bg-edge/60" />
                            <div className="h-4 w-2/3 rounded bg-edge/60" />
                        </li>
                    ))}
                </ol>
            )}

            {answer && !answer.ok && (
                <div role="alert" className="rounded-lg bg-red-50 px-4 py-3 text-sm font-medium text-red-700 dark:bg-red-950/60 dark:text-red-300">
                    {answer.message}{' '}
                    <button type="button" onClick={retry} className="font-semibold underline">{t.shabad.results.retry}</button>
                </div>
            )}

            {data && (
                <>
                    <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 border-b border-edge pb-2">
                        <h2 id="verse-results-heading" className="font-bold text-ink">{status}</h2>
                        <p className="text-sm text-ink-muted">
                            {t.shabad.results.searchedAs[data.kind]}
                            {data.alternatives.map((as) => (
                                <span key={as}>
                                    {' · '}
                                    <button type="button" onClick={() => searchAs(as)} className="font-semibold text-accent-text hover:underline">
                                        {as === 'words' ? t.shabad.results.wordsInstead : t.shabad.results.lettersInstead}
                                    </button>
                                </span>
                            ))}
                        </p>
                    </div>
                    {!data.complete && (
                        <p className="rounded-lg border border-kesri/40 bg-kesri/10 px-4 py-3 text-sm text-ink">
                            {t.shabad.results.incomplete}{' '}
                            <button type="button" onClick={retry} className="font-semibold text-accent-text underline">{t.shabad.results.retry}</button>
                        </p>
                    )}
                    {data.hits.length === 0 && data.complete && <p className="text-ink-muted">{t.shabad.results.noneTips}</p>}
                    {data.truncated && data.hits.length > 0 && <p className="text-sm text-ink-muted">{t.shabad.results.truncated}</p>}
                    {data.hits.length > 0 && (
                        <ol className="space-y-3">
                            {data.hits.map((hit) => <VerseResultCard key={hit.lineId} hit={hit} />)}
                        </ol>
                    )}
                </>
            )}
        </section>
    );
}
