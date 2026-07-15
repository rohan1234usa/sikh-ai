'use client';

import { useState } from 'react';
import Link from 'next/link';
import { MagnifyingGlassIcon, BookOpenIcon, ChatBubbleLeftRightIcon } from '@heroicons/react/24/outline';
import { normalizeVerse, type AngItem } from '@/lib/gurbani/verse';

export default function ShabadSearchPage() {
  const [query, setQuery] = useState('');
  const [currentAng, setCurrentAng] = useState(''); // New state for displayed Ang
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<AngItem[]>([]);
  const [error, setError] = useState('');

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!query) return;

    // Validation: Must be a number
    if (!/^\d+$/.test(query)) {
      setError('Please enter a valid Ang number (digits only).');
      return;
    }

    const angNumber = parseInt(query, 10);
    if (angNumber < 1 || angNumber > 1430) {
      setError('Ang number must be between 1 and 1430.');
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
        throw new Error(data.error || `Error ${res.status}: Failed to fetch`);
      }

      // Guard against an empty array too — `if (data.page)` is truthy for [],
      // which would show a blank results area with no feedback.
      if (Array.isArray(data.page) && data.page.length > 0) {
        setResults(data.page);
        setCurrentAng(query); // Set the displayed Ang only on success
      } else {
        setError('Ang not found. Please try a number between 1-1430.');
      }

    } catch (err) {
      console.error(err);
      setError(err instanceof Error && err.message ? err.message : 'Failed to fetch Gurbani.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="flex-1 flex flex-col">

      {/* Search Header */}
      <div className="bg-navy text-white py-12 px-6 flex flex-col items-center">
        <h1 className="text-3xl font-bold mb-6 text-center">
          Find by <span className="text-kesri">Ang</span>
        </h1>

        <form onSubmit={handleSearch} className="w-full max-w-xl relative">
          <input
            type="text"
            inputMode="numeric"
            aria-label="Ang number"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Enter Ang Number (1-1430)"
            className="w-full p-4 pl-12 pr-28 rounded-xl text-navy bg-white border-2 border-transparent focus:border-kesri shadow-xl transition-all placeholder:text-slate-400"
          />
          <MagnifyingGlassIcon className="w-6 h-6 text-slate-400 absolute left-4 top-1/2 -translate-y-1/2" aria-hidden="true" />
          <button
            type="submit"
            className="absolute right-2 top-2 bottom-2 bg-navy text-white px-6 rounded-lg font-bold hover:bg-kesri hover:text-navy transition"
          >
            Search
          </button>
        </form>
        <p className="mt-4 text-sm text-slate-300">
          Enter a page number to read the Gurbani from that Ang.
        </p>
      </div>

      {/* Results Area */}
      <div className="max-w-4xl mx-auto w-full p-6 flex-1">

        {loading && (
          <div className="text-center py-20 text-ink animate-pulse">
            Fetching Ang...
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
                Ang {currentAng}
              </span>
              <Link
                href={`/chat?context=shabad&ang=${currentAng}`}
                className="ml-auto inline-flex items-center gap-1.5 text-sm font-semibold text-accent-text hover:underline"
              >
                <ChatBubbleLeftRightIcon className="w-4 h-4" aria-hidden="true" />
                Ask about this Ang
              </Link>
            </div>

            {results.map((item, index) => {
              const normalized = normalizeVerse(item);
              const gurmukhi = normalized.gurmukhi || "Gurmukhi Unavailable";
              const translation = normalized.translation || "Translation unavailable";

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
                      Line {index + 1}
                    </span>
                    <span className="uppercase tracking-widest text-accent-text font-bold">
                      Guru Granth Sahib Ji
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
