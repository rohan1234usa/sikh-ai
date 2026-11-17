'use client';

import { createContext, useContext, type ReactNode } from 'react';
import { useLanguage } from '@/app/context/LanguageContext';
import { getLearnCopy, type LearnCopy } from '@/lib/i18n/learn';

// Learn's words (lib/i18n/learn), in the page's language. This module is the
// only client code that imports them, and Learn's layout
// (app/[lang]/learn/layout.tsx) is what loads it, so they ship in a script
// that only Learn's pages load, once, cached for every Learn page after.
// All three languages are in that script: the bundler puts what a layout's
// client code imports in one chunk. Passing the page's language's words from
// the server instead would send them again with every prefetch and move
// between Learn pages (measured in #85).
//
// The context holds nothing but the language's words, so the hook could
// read useLanguage() itself. The provider is there for two reasons: being
// rendered by Learn's layout is what keeps this module, and the words, in
// the layout's one chunk; and its absence makes useLearnCopy() throw, so a
// Learn component used outside Learn fails at build rather than shipping
// the words with another page. tests/learn/copy-imports.test.ts holds both.
const LearnCopyContext = createContext<LearnCopy | null>(null);

export function LearnCopyProvider({ children }: { children: ReactNode }) {
    const { lang } = useLanguage();
    return <LearnCopyContext.Provider value={getLearnCopy(lang)}>{children}</LearnCopyContext.Provider>;
}

export const useLearnCopy = (): LearnCopy => {
    const copy = useContext(LearnCopyContext);
    if (!copy) throw new Error('useLearnCopy must be used within a LearnCopyProvider');
    return copy;
};
