'use client';

import { useMemo, useSyncExternalStore } from 'react';
import { parseSearchAs, type SearchAs } from '@/lib/gurbani/query';

// The search on /shabad lives in the page's address (?q=…&as=…), so it can
// be shared, survives a reload, and is there again after Back. It's read
// from window.location, as LegacyAngLink does, rather than with
// useSearchParams, which would take the static page's search box out of its
// HTML. The server's render has no address to read: null.

export type SearchState = { q: string; as?: SearchAs };

const CHANGE = 'sikhai:shabad-search';

function subscribe(onChange: () => void) {
    window.addEventListener('popstate', onChange);
    window.addEventListener(CHANGE, onChange);
    return () => {
        window.removeEventListener('popstate', onChange);
        window.removeEventListener(CHANGE, onChange);
    };
}

export function readSearch(search: string): SearchState {
    const params = new URLSearchParams(search);
    const as = parseSearchAs(params.get('as'));
    return { q: params.get('q') ?? '', ...(as ? { as } : {}) };
}

export function searchString({ q, as }: SearchState): string {
    if (!q) return '';
    const params = new URLSearchParams({ q });
    if (as) params.set('as', as);
    return `?${params}`;
}

export function useSearchQuery(): SearchState | null {
    const search = useSyncExternalStore(subscribe, () => window.location.search, () => null);
    return useMemo(() => (search === null ? null : readSearch(search)), [search]);
}

// Shows a search on /shabad: the address changes in place (no new history
// entry, no request for the page; Next's router follows replaceState), and
// everything reading it hears.
export function showSearch(path: string, state: SearchState): void {
    window.history.replaceState(null, '', path + searchString(state));
    window.dispatchEvent(new Event(CHANGE));
}
