// The words of the Learn Punjabi pages (./en.ts says why they live apart).
// Server components and pages read them with getLearnCopy(). On the client,
// only app/components/learn/LearnCopy.tsx may import this module: it is
// loaded by Learn's layout alone, so the words ship only with Learn's pages.
// Any other client import would ship all three languages with that page
// (tests/learn/copy-imports.test.ts holds the line).

import type { Lang } from '../config';
import en, { type LearnCopy } from './en';
import pa from './pa';
import paLatn from './pa-latn';

export type { LearnCopy };

const LEARN: Record<Lang, LearnCopy> = {
    'en': en,
    'pa': pa,
    'pa-latn': paLatn,
};

export const getLearnCopy = (lang: Lang): LearnCopy => LEARN[lang];
