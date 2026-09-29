'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { MagnifyingGlassIcon } from '@heroicons/react/24/outline';
import { parseAngInput } from '@/lib/gurbani/ang';
import { useLocalePath, useT } from '../../context/LanguageContext';

// The Ang search box: it opens that Ang's own page (/shabad/{n}).
export default function AngSearch({ initial }: { initial?: number }) {
    const t = useT();
    const to = useLocalePath();
    const router = useRouter();
    const [query, setQuery] = useState(initial ? String(initial) : '');
    const [error, setError] = useState('');

    const submit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!query) return;
        const parsed = parseAngInput(query);
        if (!parsed.ok) {
            setError(parsed.reason === 'digits' ? t.shabad.invalidDigits : t.shabad.angRange);
            return;
        }
        setError('');
        router.push(to(`/shabad/${parsed.ang}`));
    };

    return (
        <>
            <form onSubmit={submit} className="w-full max-w-xl relative">
                <input
                    type="text"
                    inputMode="numeric"
                    aria-label={t.shabad.angNumberAria}
                    aria-invalid={error ? true : undefined}
                    aria-describedby={error ? 'ang-search-error' : undefined}
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
            {error && (
                <p id="ang-search-error" role="alert" className="mt-3 rounded-lg bg-red-50 px-4 py-2 text-sm font-medium text-red-700 dark:bg-red-950/60 dark:text-red-300">
                    {error}
                </p>
            )}
        </>
    );
}
