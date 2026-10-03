// The words of /privacy and /terms, for those pages' server components only:
// imported from a client component, they would ship to every page again, as
// the dictionaries do (./en.ts says why they live apart).

import type { Lang } from '../config';
import en, { type PolicyDictionary } from './en';
import pa from './pa';
import paLatn from './pa-latn';

export type { PolicyDictionary };

const POLICY: Record<Lang, PolicyDictionary> = {
    'en': en,
    'pa': pa,
    'pa-latn': paLatn,
};

export const getPolicyCopy = (lang: Lang): PolicyDictionary => POLICY[lang];
