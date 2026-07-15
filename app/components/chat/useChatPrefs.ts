'use client';

import { useCallback, useEffect, useState } from 'react';
import {
    DEFAULT_PREFS,
    isLanguageId,
    isLensId,
    isModeId,
    type LanguageId,
    type LensId,
    type ModeId,
} from '@/lib/chat/config';

export type ChatPrefs = { lensId: LensId; modeId: ModeId; languageId: LanguageId };

const STORAGE_KEY = 'sikhai.chat.prefs.v1';

type StoredPrefs = Partial<Record<keyof ChatPrefs, unknown>> & { version?: number };

export function useChatPrefs() {
    const [prefs, setPrefs] = useState<ChatPrefs>(DEFAULT_PREFS);
    const [hydrated, setHydrated] = useState(false);

    // Same post-hydration pattern as useChatStorage: SSR renders defaults.
    // Each field is validated independently so one bad value can't poison the rest.
    useEffect(() => {
        try {
            const raw = localStorage.getItem(STORAGE_KEY);
            if (raw) {
                const parsed = JSON.parse(raw) as StoredPrefs;
                // eslint-disable-next-line react-hooks/set-state-in-effect
                setPrefs({
                    lensId: isLensId(parsed?.lensId) ? parsed.lensId : DEFAULT_PREFS.lensId,
                    modeId: isModeId(parsed?.modeId) ? parsed.modeId : DEFAULT_PREFS.modeId,
                    languageId: isLanguageId(parsed?.languageId) ? parsed.languageId : DEFAULT_PREFS.languageId,
                });
            }
        } catch {
            // corrupt JSON or storage blocked — keep defaults
        }
        setHydrated(true);
    }, []);

    const update = useCallback((patch: Partial<ChatPrefs>) => {
        setPrefs(prev => {
            const next = { ...prev, ...patch };
            try {
                localStorage.setItem(STORAGE_KEY, JSON.stringify({ version: 1, ...next }));
            } catch { /* prefs just won't survive a reload */ }
            return next;
        });
    }, []);

    return { prefs, update, hydrated };
}
