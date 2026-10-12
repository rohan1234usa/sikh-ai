'use client';

import IntentLink from '@/app/components/IntentLink';
import type { VerseHit } from '@/lib/gurbani/query';
import { localName, shabadPath } from '@/lib/gurbani/shabad';
import { fmt } from '@/lib/i18n/fmt';
import { useLanguage } from '../../context/LanguageContext';
import { TukkLines } from '../gurbani/Tukk';

// One shabad found: the line that matched, its transliteration and
// translation, and where it is. The whole row opens the shabad at that
// line. The link prefetches only on intent: each result is a shabad page
// that may never have been built, and building it asks GurbaniNow.
//
// The other shabads with the same line are counted among the lines the
// lookups returned. When the answer was `truncated`, more lines matched than
// were read or shown, so there may be others: the count is shown as "29+".
export default function VerseResultCard({ hit, truncated }: { hit: VerseHit; truncated: boolean }) {
    const { lang, t, href } = useLanguage();
    const where = [
        hit.ang === null ? null : fmt(t.shabad.angLabel, { n: hit.ang }),
        localName(lang, hit.writer, hit.writerGurmukhi),
        localName(lang, hit.raag, hit.raagGurmukhi),
    ].filter(Boolean).join(' · ');
    return (
        <li className="relative border-b border-edge px-2 py-5 transition-colors hover:bg-surface-raised focus-within:ring-2 focus-within:ring-focus-ring">
            <TukkLines
                size="list"
                gurmukhi={
                    <IntentLink
                        href={href(shabadPath(hit.shabadId, hit.lineId))}
                        className="outline-none after:absolute after:inset-0 after:content-['']"
                    >
                        {hit.gurmukhi}
                    </IntentLink>
                }
                transliteration={hit.transliteration}
                translation={hit.translation ? <span className="line-clamp-2">{hit.translation}</span> : undefined}
            />
            <p lang={lang === 'pa' ? 'pa' : undefined} className="mt-3 text-xs font-semibold text-ink-muted">
                {where}
                {hit.sameLineIn > 0 && <span className="text-ink-faint"> · {fmt(t.shabad.results.sameLine, { n: truncated ? `${hit.sameLineIn}+` : hit.sameLineIn })}</span>}
            </p>
        </li>
    );
}
