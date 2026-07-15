'use client';

import { createContext, useCallback, useContext, useState } from 'react';
import { useRouter } from 'next/navigation';
import { LANG_COOKIE, LANG_COOKIE_MAX_AGE, LANG_META, type Lang } from '@/lib/i18n/config';
import { getDictionary, type Dictionary } from '@/lib/i18n';

type LanguageContextType = {
    lang: Lang;
    setLang: (next: Lang) => void;
    t: Dictionary;
};

const LanguageContext = createContext<LanguageContextType | null>(null);

export function LanguageProvider({ initialLang, children }: { initialLang: Lang; children: React.ReactNode }) {
    // Seeded from the server-read cookie, so SSR HTML and the first client
    // render always agree — no hydration mismatch, no flash of English.
    const [lang, setLangState] = useState<Lang>(initialLang);
    const router = useRouter();

    const setLang = useCallback((next: Lang) => {
        setLangState(next);                                       // client components: instant
        document.documentElement.lang = LANG_META[next].htmlLang; // font/a11y: instant, like the dark class
        try {
            document.cookie = `${LANG_COOKIE}=${next}; path=/; max-age=${LANG_COOKIE_MAX_AGE}; samesite=lax`;
        } catch { /* cookies blocked — the switch still applies for this session */ }
        router.refresh(); // server-rendered text re-renders with the new cookie; client state survives
    }, [router]);

    return (
        <LanguageContext.Provider value={{ lang, setLang, t: getDictionary(lang) }}>
            {children}
        </LanguageContext.Provider>
    );
}

export const useLanguage = () => {
    const context = useContext(LanguageContext);
    if (!context) throw new Error('useLanguage must be used within a LanguageProvider');
    return context;
};

export const useT = () => useLanguage().t;
