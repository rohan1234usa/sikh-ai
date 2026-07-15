'use client';

import { useState } from 'react';
import Link from 'next/link';
import { MagnifyingGlassIcon, BookOpenIcon, ChatBubbleLeftRightIcon } from '@heroicons/react/24/outline';
import { normalizeVerse, type AngItem } from '@/lib/gurbani/verse';
import { useT } from '../context/LanguageContext';
import type { Dictionary } from '@/lib/i18n';
import { fmt } from '@/lib/i18n/fmt';

export default function ShabadSearchPage() {
  const t = useT();
  const [query, setQuery] = useState('');
  const [currentAng, setCurrentAng] = useState(''); // New state for displayed Ang
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<AngItem[]>([]);
  const [error, setError] = useState('');

  // Word order around the highlighted word differs per language, so split the
  // template on {ang} and render the styled span between the halves.
  const [titleBefore, titleAfter] = t.shabad.title.split('{ang}');

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!query) return;

    // Validation: Must be a number
    if (!/^\d+$/.test(query)) {
      setError(t.shabad.invalidDigits);
      return;
    }

    const angNumber = parseInt(query, 10);
    if (angNumber < 1 || angNumber > 1430) {
      setError(t.shabad.angRange);
      return;
    }

    setLoading(true);
    setError('');
    setResults([]);
    setCurrentAng(''); // Reset current Ang while loading

    try {
      // Always 'ang' search now.
      const res = await fetch(`/api/shabad?query=${encodeURIComponent(query)}`);
      const data = await res.json();

      if (!res.ok) {
        // Prefer the translated message for a known error code
        const codeText = typeof data?.code === 'string' && data.code in t.errors
          ? t.errors[data.code as keyof Dictionary['errors']]
          : null;
        throw new Error(codeText || data.error || t.shabad.fetchFailed);
      }

      // Guard against an empty array too — `if (data.page)` is truthy for [],
      // which would show a blank results area with no feedback.
      if (Array.isArray(data.page) && data.page.length > 0) {
        setResults(data.page);
        setCurrentAng(query); // Set the displayed Ang only on success
      } else {
        setError(t.shabad.notFound);
      }

    } catch (err) {
      console.error(err);
      setError(err instanceof Error && err.message ? err.message : t.shabad.fetchFailed);
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="flex-1 flex flex-col">

      {/* Search Header */}
      <div className="bg-navy text-white py-12 px-6 flex flex-col items-center">
        <h1 className="text-3xl font-bold mb-6 text-center">
          {titleBefore}<span className="text-kesri">{t.shabad.angWord}</span>{titleAfter}
        </h1>

        <form onSubmit={handleSearch} className="w-full max-w-xl relative">
          <input
            type="text"
            inputMode="numeric"
            aria-label={t.shabad.angNumberAria}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t.shabad.placeholder}
            className="w-full p-4 pl-12 pr-28 rounded-xl text-navy bg-white border-2 border-transparent focus:border-kesri shadow-xl transition-all placeholder:text-slate-400"
          />
          <MagnifyingGlassIcon className="w-6 h-6 text-slate-400 absolute left-4 top-1/2 -translate-y-1/2" aria-hidden="true" />
          <button
            type="submit"
            className="absolute right-2 top-2 bottom-2 bg-navy text-white px-6 rounded-lg font-bold hover:bg-kesri hover:text-navy transition"
          >
            {t.shabad.searchButton}
          </button>
        </form>
        <p className="mt-4 text-sm text-slate-300">
          {t.shabad.helpText}
        </p>
      </div>

      {/* Results Area */}
      <div className="max-w-4xl mx-auto w-full p-6 flex-1">

        {loading && (
          <div className="text-center py-20 text-ink animate-pulse">
            {t.shabad.fetching}
          </div>
        )}

        {error && (
          <div role="alert" className="text-center py-20 text-red-600 bg-red-50 rounded-xl border border-red-100 dark:bg-red-950/40 dark:text-red-400 dark:border-red-900">
            {error}
          </div>
        )}

        {!loading && !error && results.length > 0 && (
          <div className="space-y-6">

            <div className="flex items-center gap-2 mb-4 pb-2 border-b border-edge">
              <BookOpenIcon className="w-5 h-5 text-accent-text" aria-hidden="true" />
              <span className="text-ink font-bold">
                {fmt(t.shabad.angLabel, { n: currentAng })}
              </span>
              <Link
                href={`/chat?context=shabad&ang=${currentAng}`}
                className="ml-auto inline-flex items-center gap-1.5 text-sm font-semibold text-accent-text hover:underline"
              >
                <ChatBubbleLeftRightIcon className="w-4 h-4" aria-hidden="true" />
                {t.shabad.askAboutAng}
              </Link>
            </div>

            {results.map((item, index) => {
              const normalized = normalizeVerse(item);
              const gurmukhi = normalized.gurmukhi || t.shabad.gurmukhiUnavailable;
              const translation = normalized.translation || t.shabad.translationUnavailable;

              return (
                <div key={index} className="bg-surface-raised p-4 sm:p-6 rounded-xl shadow-sm border border-edge hover:shadow-md transition">
                  <p lang="pa" className="text-2xl md:text-3xl text-ink font-bold text-center leading-relaxed mb-4 font-gurmukhi">
                    {gurmukhi}
                  </p>
                  <p className="text-ink-muted text-center italic text-lg mb-4">
                    {translation}
                  </p>
                  <div className="flex justify-between items-center text-xs text-ink-faint border-t border-edge pt-4 mt-2">
                    <span>
                      {fmt(t.shabad.lineN, { n: index + 1 })}
                    </span>
                    <span className="uppercase tracking-widest text-accent-text font-bold">
                      {t.shabad.granth}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

    </main>
  );
}
