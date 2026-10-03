// Ang numbers from addresses (/shabad/{n}). What someone types into the
// search box, an Ang among other things, is ./query.ts's to read.

import { MAX_ANG } from './citations';

// An address's Ang: only its one spelling (no leading zeros or signs), so
// each Ang has one page and one cache entry.
export function parseAngParam(param: string): number | null {
    if (!/^[1-9]\d{0,3}$/.test(param)) return null;
    const ang = Number(param);
    return ang <= MAX_ANG ? ang : null;
}
