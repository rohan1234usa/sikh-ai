'use client';

import { createContext, useContext, type ReactNode } from 'react';
import type { LearnCopy } from '@/lib/i18n/learn';

// Learn's words (lib/i18n/learn), in the page's language. Learn's layout
// (app/[lang]/learn/layout.tsx) reads them on the server and provides them
// here, so they reach only Learn's pages. A client component that imported
// lib/i18n/learn itself would ship all three languages in its script.
const LearnCopyContext = createContext<LearnCopy | null>(null);

export function LearnCopyProvider({ copy, children }: { copy: LearnCopy; children: ReactNode }) {
    return <LearnCopyContext.Provider value={copy}>{children}</LearnCopyContext.Provider>;
}

export const useLearnCopy = (): LearnCopy => {
    const copy = useContext(LearnCopyContext);
    if (!copy) throw new Error('useLearnCopy must be used within a LearnCopyProvider');
    return copy;
};
