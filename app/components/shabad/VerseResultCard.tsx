'use client';

import IntentLink from '@/app/components/IntentLink';
import type { VerseHit } from '@/lib/gurbani/query';
import { localName, shabadPath } from '@/lib/gurbani/shabad';
import { fmt } from '@/lib/i18n/fmt';
import { useLanguage } from '../../context/LanguageContext';

// One shabad found: the line that matched, its transliteration and
// translation, and where it is. The whole card opens the shabad at that
// line. The link prefetches only on intent: each result is a shabad page
// that may never have been built, and building it asks GurbaniNow.
export default function VerseResultCard({ hit }: { hit: VerseHit }) {
    const { lang, t, href } = useLanguage();
    const where = [
        hit.ang === null ? null : fmt(t.shabad.angLabel, { n: hit.ang }),
        localName(lang, hit.writer, hit.writerGurmukhi),
        localName(lang, hit.raag, hit.raagGurmukhi),
    ].filter(Boolean).join(' · ');
    return (
        <li className="relative rounded-xl border border-edge bg-surface-raised p-4 sm:p-6 shadow-sm transition-colors hover:border-kesri/60 focus-within:ring-2 focus-within:ring-kesri">
            <IntentLink
                href={href(shabadPath(hit.shabadId, hit.lineId))}
                className="block outline-none after:absolute after:inset-0 after:rounded-xl after:content-['']"
            >
                <span lang="pa" className="block font-gurmukhi text-xl sm:text-2xl font-bold leading-relaxed text-ink">{hit.gurmukhi}</span>
            </IntentLink>
            {hit.transliteration && <p lang="pa-Latn" className="mt-1 text-sm text-ink-faint">{hit.transliteration}</p>}
            {hit.translation && <p lang="en" className="mt-2 italic text-ink-muted line-clamp-2">{hit.translation}</p>}
            <p lang={lang === 'pa' ? 'pa' : undefined} className="mt-3 text-xs font-semibold text-ink-muted">
                {where}
                {hit.sameLineIn > 0 && <span className="text-ink-faint"> · {fmt(t.shabad.results.sameLine, { n: hit.sameLineIn })}</span>}
            </p>
        </li>
    );
}
