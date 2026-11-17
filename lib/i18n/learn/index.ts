// The words of the Learn Punjabi pages, for server components only: imported
// from a client component, they would ship to every page that component is
// on, all three languages at once (./en.ts says why they live apart). Learn's
// layout hands one language's to LearnCopyProvider, which Learn's client
// components read with useLearnCopy(), typed with `import type { LearnCopy }`,
// which ships nothing.

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
