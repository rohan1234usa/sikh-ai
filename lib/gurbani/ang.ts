// Ang numbers from what someone typed and from addresses (/shabad/{n}).

import { MAX_ANG } from './citations';

export type AngInput = { ok: true; ang: number } | { ok: false; reason: 'digits' | 'range' };

// The search box: digits only, 1 to 1430. Spaces around are forgiven.
export function parseAngInput(value: string): AngInput {
    const v = value.trim();
    if (!/^\d+$/.test(v)) return { ok: false, reason: 'digits' };
    const ang = Number(v);
    return ang >= 1 && ang <= MAX_ANG ? { ok: true, ang } : { ok: false, reason: 'range' };
}

// An address's Ang: only its one spelling (no leading zeros or signs), so
// each Ang has one page and one cache entry.
export function parseAngParam(param: string): number | null {
    if (!/^[1-9]\d{0,3}$/.test(param)) return null;
    const ang = Number(param);
    return ang <= MAX_ANG ? ang : null;
}
