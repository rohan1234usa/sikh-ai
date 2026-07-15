// All dictionaries are statically imported (a few KB each) so a language
// switch is instant on the client — no dynamic-import waterfall.

import type { Lang } from './config';
import en, { type Dictionary } from './dictionaries/en';
import pa from './dictionaries/pa';
import paLatn from './dictionaries/pa-latn';

export type { Dictionary };

const DICTIONARIES: Record<Lang, Dictionary> = {
    'en': en,
    'pa': pa,
    'pa-latn': paLatn,
};

export const getDictionary = (lang: Lang): Dictionary => DICTIONARIES[lang];
