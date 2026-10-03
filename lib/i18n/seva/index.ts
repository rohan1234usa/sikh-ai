// The words of the Seva pages, for server components only: imported from a
// client component, they would ship to every page, as the dictionaries do
// (./en.ts says why they live apart). A client island takes its part as a
// prop, typed with `import type { SevaCopy }`, which ships nothing.

import type { Lang } from '../config';
import en, { type SevaCopy } from './en';
import pa from './pa';
import paLatn from './pa-latn';

export type { SevaCopy };

const SEVA: Record<Lang, SevaCopy> = {
    'en': en,
    'pa': pa,
    'pa-latn': paLatn,
};

export const getSevaCopy = (lang: Lang): SevaCopy => SEVA[lang];
