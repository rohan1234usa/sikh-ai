'use client';

import { useCallback, useEffect, useState } from 'react';
import type { IdentifyResult } from '@/lib/identify/config';

export type IdentifyHistoryEntry = {
    id: string;
    // The structured result (~2-3 KB) is stored so restoring an entry is
    // instant and free. The audio never is: it is the sensitive part, it is
    // orders of magnitude larger, and nothing in the UI replays it.
    result: IdentifyResult;
    createdAt: number;
};

const STORAGE_KEY = 'sikhai.identify.history.v1'; // bump the suffix on schema changes
const MAX_ENTRIES = 20;

type StoredHistory = { version: 1; updatedAt: number; entries: IdentifyHistoryEntry[] };

export function useIdentifyHistory() {
    const [entries, setEntries] = useState<IdentifyHistoryEntry[]>([]);
    const [hydrated, setHydrated] = useState(false);

    const persist = useCallback((list: IdentifyHistoryEntry[]) => {
        const payload: StoredHistory = { version: 1, updatedAt: Date.now(), entries: list };
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
        } catch {
            // quota: retry once with the newest half (always at least one), then give up
            if (list.length <= 1) return;
            try {
                localStorage.setItem(STORAGE_KEY, JSON.stringify({
                    ...payload,
                    entries: list.slice(0, Math.max(1, Math.floor(list.length / 2))),
                }));
            } catch { /* identification still works without persistence */ }
        }
    }, []);

    // Load once after mount — SSR renders no history, so reading localStorage
    // has to happen in a post-hydration effect.
    useEffect(() => {
        try {
            const raw = localStorage.getItem(STORAGE_KEY);
            if (raw) {
                const parsed = JSON.parse(raw) as StoredHistory;
                if (parsed?.version === 1 && Array.isArray(parsed.entries)) {
                    // eslint-disable-next-line react-hooks/set-state-in-effect
                    setEntries(parsed.entries.slice(0, MAX_ENTRIES));
                }
            }
        } catch {
            // corrupt JSON or storage blocked — start empty
        }
        setHydrated(true);
    }, []);

    // Only successful identifications are worth keeping. A no-match row would
    // list nothing the user could click, and a "we heard nothing" row is just
    // a reminder of a failed attempt.
    const add = useCallback((result: IdentifyResult) => {
        if (result.status !== 'matched' || result.matches.length === 0) return;
        setEntries(prev => {
            const full: IdentifyHistoryEntry = {
                result,
                id: crypto.randomUUID(),
                createdAt: Date.now(),
            };
            // Consecutive dedupe: identifying the same Shabad again replaces the
            // top entry rather than stacking duplicates.
            const dupOfTop = prev[0]?.result.matches[0]?.shabadId === result.matches[0].shabadId;
            const next = [full, ...(dupOfTop ? prev.slice(1) : prev)].slice(0, MAX_ENTRIES);
            persist(next);
            return next;
        });
    }, [persist]);

    const remove = useCallback((id: string) => {
        setEntries(prev => {
            const next = prev.filter(e => e.id !== id);
            persist(next);
            return next;
        });
    }, [persist]);

    const clear = useCallback(() => {
        try { localStorage.removeItem(STORAGE_KEY); } catch { /* ignore */ }
        setEntries([]);
    }, []);

    return { entries, hydrated, add, remove, clear };
}
