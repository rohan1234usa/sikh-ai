'use client';

import { useCallback, useEffect, useState } from 'react';
import type { SourceHint, TranslationResult } from '@/lib/translate/config';

export type TranslateHistoryEntry = {
    id: string;
    input: string;
    sourceHint: SourceHint;
    // The full structured result (~1-2 KB) is stored so restoring an entry is
    // instant and free — no re-fetch. 30 entries ≈ 60 KB, trivial vs quota.
    result: TranslationResult;
    createdAt: number;
};

const STORAGE_KEY = 'sikhai.translate.history.v1'; // bump the suffix on schema changes
const MAX_ENTRIES = 30;

type StoredHistory = { version: 1; updatedAt: number; entries: TranslateHistoryEntry[] };

export function useTranslateHistory() {
    const [entries, setEntries] = useState<TranslateHistoryEntry[]>([]);
    const [hydrated, setHydrated] = useState(false);

    const persist = useCallback((list: TranslateHistoryEntry[]) => {
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
            } catch { /* the translator still works without persistence */ }
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

    // Called only on successful API completion, so persistence is
    // save-on-finalize by construction.
    const add = useCallback((entry: Omit<TranslateHistoryEntry, 'id' | 'createdAt'>) => {
        setEntries(prev => {
            const full: TranslateHistoryEntry = {
                ...entry,
                id: crypto.randomUUID(),
                createdAt: Date.now(),
            };
            // Consecutive dedupe: re-running the top entry replaces it with the
            // fresh result instead of stacking duplicates.
            const dupOfTop =
                prev[0]?.input.trim().toLowerCase() === entry.input.trim().toLowerCase();
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
