import type { Lang } from './config';

// A day, in the site language. Romanized Punjabi uses English month names:
// the 'pa' locale would write them in Gurmukhi, which that interface avoids.
export function formatDate(ts: number, lang: Lang): string {
    return new Intl.DateTimeFormat(lang === 'pa' ? 'pa' : 'en', { dateStyle: 'medium' }).format(ts);
}

// A calendar day, given as 'YYYY-MM-DD', written out in full ("29 September
// 2026") and the same wherever the page is built. Romanized Punjabi uses
// English month names, as above.
export function formatDay(isoDay: string, lang: Lang): string {
    return new Intl.DateTimeFormat(lang === 'pa' ? 'pa' : 'en-GB', { dateStyle: 'long', timeZone: 'UTC' })
        .format(new Date(`${isoDay}T00:00:00Z`));
}
