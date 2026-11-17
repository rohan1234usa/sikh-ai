// All three dictionaries are statically imported, so every page's script
// carries all three. Words that only one part of the site reads live apart
// and are read on the server (lib/i18n/policy, seva, account, talk and
// learn), so they reach only the pages that need them.

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
