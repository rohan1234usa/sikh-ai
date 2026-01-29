'use client';

import { useState } from 'react';
import Link from 'next/link';
import { MagnifyingGlassIcon, BookOpenIcon } from '@heroicons/react/24/outline';

export default function ShabadSearchPage() {
  const [query, setQuery] = useState('');
  const [currentAng, setCurrentAng] = useState(''); // New state for displayed Ang
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<any[]>([]);
  const [error, setError] = useState('');

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!query) return;

    // Validation: Must be a number
    if (!/^\d+$/.test(query)) {
      setError('Please enter a valid valid Ang number (digits only).');
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

      if (data.page) {
        setResults(data.page);
        setCurrentAng(query); // Set the displayed Ang only on success
      } else {
        setError('Ang not found. Please try a number between 1-1430.');
      }

    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Failed to fetch Gurbani.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-offwhite font-sans flex flex-col">

      {/* Navigation */}
      <nav className="bg-navy text-white py-4 px-6 flex justify-between items-center shadow-lg sticky top-0 z-10">
        <Link href="/" className="font-bold flex items-center gap-2 hover:text-kesri transition">
          <span className="text-kesri">←</span> Back Home
        </Link>
        <h1 className="text-lg font-bold tracking-wide">Gurbani Search</h1>
        <div className="w-8"></div>
      </nav>

      {/* Search Header */}
      <div className="bg-navy text-white py-12 px-6 flex flex-col items-center">
        <h2 className="text-3xl font-bold mb-6 text-center">
          Find by <span className="text-kesri">Ang</span>
        </h2>

        <form onSubmit={handleSearch} className="w-full max-w-xl relative">
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Enter Ang Number (1-1430)"
            className="w-full p-4 pl-12 rounded-xl text-navy bg-white border-2 border-transparent focus:border-kesri focus:outline-none shadow-xl transition-all placeholder:text-slate-400"
          />
          <MagnifyingGlassIcon className="w-6 h-6 text-slate-400 absolute left-4 top-1/2 -translate-y-1/2" />
          <button
            type="submit"
            className="absolute right-2 top-2 bottom-2 bg-navy text-white px-6 rounded-lg font-bold hover:bg-kesri hover:text-navy transition"
          >
            Search
          </button>
        </form>
        <p className="mt-4 text-sm text-slate-400">
          Enter a page number to read the Gurbani from that Ang.
        </p>
      </div>

      {/* Results Area */}
      <div className="max-w-4xl mx-auto w-full p-6 flex-1">

        {loading && (
          <div className="text-center py-20 text-navy animate-pulse">
            Fetching Ang...
          </div>
        )}

        {error && (
          <div className="text-center py-20 text-red-600 bg-red-50 rounded-xl border border-red-100">
            {error}
          </div>
        )}

        {!loading && !error && results.length > 0 && (
          <div className="space-y-6">

            <div className="flex items-center gap-2 mb-4 pb-2 border-b border-slate-200">
              <BookOpenIcon className="w-5 h-5 text-kesri" />
              <span className="text-navy font-bold">
                Ang {currentAng}
              </span>
            </div>

            {results.map((item, index) => {
              const content = item.line || item.verse || item;

              const gurmukhi =
                content.gurmukhi?.unicode ||
                content.gurbani?.gurmukhi ||
                content.gurmukhi ||
                "Gurmukhi Unavailable";

              const translation =
                content.translation?.english?.default ||
                content.translation?.english ||
                "Translation unavailable";

              // For Ang search, results are typically verses on that page.

              return (
                <div key={index} className="bg-white p-6 rounded-xl shadow-sm border border-slate-100 hover:shadow-md transition">
                  <p className="text-2xl md:text-3xl text-navy font-bold text-center leading-relaxed mb-4 font-serif">
                    {gurmukhi}
                  </p>
                  <p className="text-slate-600 text-center italic text-lg mb-4">
                    {translation}
                  </p>
                  <div className="flex justify-between items-center text-xs text-slate-400 border-t border-slate-50 pt-4 mt-2">
                    <span>
                      Line {index + 1}
                    </span>
                    <span className="uppercase tracking-widest text-kesri font-bold">
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