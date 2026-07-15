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

// languageId is nullable: null means "follow the site language" (the default).
// Picking a pill in chat settings stores an explicit override that the site
// language no longer touches.
export type ChatPrefs = { lensId: LensId; modeId: ModeId; languageId: LanguageId | null };

const STORAGE_KEY = 'sikhai.chat.prefs.v1';
const STORAGE_VERSION = 2;

const CLIENT_DEFAULT_PREFS: ChatPrefs = {
    lensId: DEFAULT_PREFS.lensId,
    modeId: DEFAULT_PREFS.modeId,
    languageId: null,
};

type StoredPrefs = Partial<Record<keyof ChatPrefs, unknown>> & { version?: number };

function parseLanguageId(raw: unknown, version: number): LanguageId | null {
    if (raw === null || !isLanguageId(raw)) return null;
    // v1 always persisted a languageId, so an explicit "English" pick can't be
    // told apart from the untouched default — treat old 'english' as
    // follow-site; keep genuine overrides (bilingual/punjabi).
    if (version < 2 && raw === 'english') return null;
    return raw;
}

export function useChatPrefs() {
    const [prefs, setPrefs] = useState<ChatPrefs>(CLIENT_DEFAULT_PREFS);
    const [hydrated, setHydrated] = useState(false);

    // Same post-hydration pattern as useChatStorage: SSR renders defaults.
    // Each field is validated independently so one bad value can't poison the rest.
    useEffect(() => {
        try {
            const raw = localStorage.getItem(STORAGE_KEY);
            if (raw) {
                const parsed = JSON.parse(raw) as StoredPrefs;
                const version = typeof parsed?.version === 'number' ? parsed.version : 1;
                // eslint-disable-next-line react-hooks/set-state-in-effect
                setPrefs({
                    lensId: isLensId(parsed?.lensId) ? parsed.lensId : DEFAULT_PREFS.lensId,
                    modeId: isModeId(parsed?.modeId) ? parsed.modeId : DEFAULT_PREFS.modeId,
                    languageId: parseLanguageId(parsed?.languageId, version),
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
                localStorage.setItem(STORAGE_KEY, JSON.stringify({ version: STORAGE_VERSION, ...next }));
            } catch { /* prefs just won't survive a reload */ }
            return next;
        });
    }, []);

    return { prefs, update, hydrated };
}
