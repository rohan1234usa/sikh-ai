// The words of removing what the site keeps (./en.ts says why they live
// apart): /privacy passes its controls theirs, and the Delete account dialog,
// loaded only when it opens, reads them here.

import type { Lang } from '../config';
import en, { type AccountCopy } from './en';
import pa from './pa';
import paLatn from './pa-latn';

export type { AccountCopy };

const ACCOUNT: Record<Lang, AccountCopy> = {
    'en': en,
    'pa': pa,
    'pa-latn': paLatn,
};

export const getAccountCopy = (lang: Lang): AccountCopy => ACCOUNT[lang];
