import type { Lang } from './config';

// A day, in the site language. Romanized Punjabi uses English month names:
// the 'pa' locale would write them in Gurmukhi, which that interface avoids.
export function formatDate(ts: number, lang: Lang): string {
    return new Intl.DateTimeFormat(lang === 'pa' ? 'pa' : 'en', { dateStyle: 'medium' }).format(ts);
}
