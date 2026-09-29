'use client';

import { createContext, useCallback, useContext, useMemo } from 'react';
import { LANG_COOKIE, LANG_COOKIE_MAX_AGE, type Lang } from '@/lib/i18n/config';
import { localePath, switchLocale } from '@/lib/i18n/paths';
import { getDictionary, type Dictionary } from '@/lib/i18n';

type LanguageContextType = {
    lang: Lang;
    setLang: (next: Lang) => void;
    t: Dictionary;
    // A path ('/chat') as a URL in the current language ('/pa/chat').
    href: (path: string) => string;
};

const LanguageContext = createContext<LanguageContextType | null>(null);

// The language is the URL's (app/[lang]), so the provider simply follows the
// layout that renders it: the built HTML and the first client render agree.
export function LanguageProvider({ lang, children }: { lang: Lang; children: React.ReactNode }) {
    const setLang = useCallback((next: Lang) => {
        if (next === lang) return;
        // Remembered, so an unprefixed link opens in this language next time
        // (lib/i18n/routing.ts).
        try {
            document.cookie = `${LANG_COOKIE}=${next}; path=/; max-age=${LANG_COOKIE_MAX_AGE}; samesite=lax`;
        } catch { /* cookies blocked: the switch still works, it just isn't remembered */ }
        // The same page at its address in the other language. Each language
        // has its own root layout, so this is a full page load either way. A
        // reply still streaming is saved as far as it got (the runtime's
        // pagehide flush) and shows as interrupted.
        const { pathname, search, hash } = window.location;
        window.location.assign(switchLocale(pathname, next) + search + hash);
    }, [lang]);

    const value = useMemo<LanguageContextType>(() => ({
        lang,
        setLang,
        t: getDictionary(lang),
        href: (path: string) => localePath(lang, path),
    }), [lang, setLang]);

    return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export const useLanguage = () => {
    const context = useContext(LanguageContext);
    if (!context) throw new Error('useLanguage must be used within a LanguageProvider');
    return context;
};

export const useT = () => useLanguage().t;

// A path ('/chat') as a URL in the current language ('/pa/chat').
export const useLocalePath = () => useLanguage().href;
