// The words of the Talk page, for server components only: imported from a
// client component, they would ship to every page, as the dictionaries do
// (./en.ts says why they live apart). The page hands them to TalkScreen as a
// prop, typed with `import type { TalkCopy }`, which ships nothing.

import type { Lang } from '../config';
import en, { type TalkCopy } from './en';
import pa from './pa';
import paLatn from './pa-latn';

export type { TalkCopy };

const TALK: Record<Lang, TalkCopy> = {
    'en': en,
    'pa': pa,
    'pa-latn': paLatn,
};

export const getTalkCopy = (lang: Lang): TalkCopy => TALK[lang];
