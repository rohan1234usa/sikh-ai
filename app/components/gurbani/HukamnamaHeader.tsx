import Link from 'next/link';
import type { Hukamnama } from '@/lib/gurbani/shabad';
import type { Lang } from '@/lib/i18n/config';
import type { Dictionary } from '@/lib/i18n';
import { fmt } from '@/lib/i18n/fmt';
import { localePath } from '@/lib/i18n/paths';

// The head of today's Hukamnama, on /hukamnama (as its h1) and on the home
// page (as an h2): the date, where it comes from, the raag in Gurmukhi, and
// the writer and Ang. It sits on the site's one gradient, the dawn: Amrit
// Vela, when the Hukam is taken. The gradient's stops are chosen so every
// colour of text on it keeps WCAG AA at every point (globals.css, .dawn).
export default function HukamnamaHeader({ hukamnama, lang, t, level }: {
    hukamnama: Hukamnama;
    lang: Lang;
    t: Dictionary;
    level: 'h1' | 'h2';
}) {
    const Heading = level;
    const { date } = hukamnama;
    // The Gurmukhi month on the Gurmukhi page; digits stay Western (site
    // convention).
    const month = date && ((lang === 'pa' && date.monthGurmukhi) || date.month);
    const when = date && month ? fmt(t.hukamnama.dateFormat, { month, date: date.day, year: date.year }) : t.hukamnama.today;
    const writer = (lang === 'pa' && hukamnama.writerGurmukhi) || hukamnama.writer;
    // On /pa a writer with no Gurmukhi name falls back to English, tagged so.
    const writerLang = lang === 'pa' && !hukamnama.writerGurmukhi ? 'en' : undefined;
    return (
        <header className="dawn border-b border-rule-gold px-6 py-8 text-center">
            <Heading className="text-sm font-semibold uppercase tracking-widest text-accent-text">{t.hukamnama.title}</Heading>
            <p className="mt-1 text-sm text-ink-muted">
                {when} · {t.hukamnama.liveFrom}
            </p>
            {hukamnama.raagGurmukhi && (
                <p lang="pa" className="mt-5 font-gurmukhi text-2xl text-ink md:text-3xl">{hukamnama.raagGurmukhi}</p>
            )}
            {(writer || hukamnama.ang !== null) && (
                <p className="mt-2 text-xs font-semibold uppercase tracking-widest text-ink-faint">
                    {writer && <span lang={writerLang}>{writer}</span>}
                    {writer && hukamnama.ang !== null && ' · '}
                    {hukamnama.ang !== null && (
                        <Link href={localePath(lang, `/shabad/${hukamnama.ang}`)} className="text-link hover:underline">
                            {fmt(t.hukamnama.ang, { n: hukamnama.ang })}
                        </Link>
                    )}
                </p>
            )}
        </header>
    );
}
