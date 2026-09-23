'use client';

import { useMemo } from 'react';
import Link from 'next/link';
import { ArrowTopRightOnSquareIcon, CheckBadgeIcon, ExclamationTriangleIcon, QuestionMarkCircleIcon } from '@heroicons/react/24/outline';
import { useLanguage } from '../../context/LanguageContext';
import { fmt } from '@/lib/i18n/fmt';
import { MAX_ANG, SGGS_SOURCE_ID, sanitizeCitations, type Citation, type CitationLine } from '@/lib/gurbani/citations';

// Cards under an AI reply showing what GurbaniNow says about each line the
// reply quoted. Everything in a card's source line — the Gurmukhi, the
// translation, Ang, writer, raag — is the source's own text, never the model's.

const STATUS = {
    'verified': { Icon: CheckBadgeIcon, tone: 'text-emerald-700 dark:text-emerald-400' },
    'wrong-ang': { Icon: ExclamationTriangleIcon, tone: 'text-accent-text' },
    'close': { Icon: ExclamationTriangleIcon, tone: 'text-accent-text' },
    'unverified': { Icon: QuestionMarkCircleIcon, tone: 'text-ink-muted' },
} as const;

const isSggsAng = (line: CitationLine) =>
    line.source.id === SGGS_SOURCE_ID && line.ang !== null && line.ang >= 1 && line.ang <= MAX_ANG;

function AngLink({ ang }: { ang: number }) {
    const { t } = useLanguage();
    return (
        <Link
            href={`/shabad?ang=${ang}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-xs font-semibold text-accent-text hover:underline"
        >
            {fmt(t.chat.citations.openAng, { n: ang })}
            <ArrowTopRightOnSquareIcon className="w-3.5 h-3.5" aria-hidden="true" />
        </Link>
    );
}

function SourceLine({ line }: { line: CitationLine }) {
    const { lang, t } = useLanguage();
    const pa = lang === 'pa';
    const where = line.ang === null ? null
        : isSggsAng(line) ? fmt(t.shabad.angLabel, { n: line.ang })
            : fmt(t.chat.citations.pageN, { n: line.ang });
    const meta = [
        where,
        (pa && line.writerGurmukhi) || line.writer,
        (pa && line.raagGurmukhi) || line.raag,
        (pa && line.source.nameGurmukhi) || line.source.name,
    ].filter(Boolean);
    return (
        <div className="space-y-1">
            <p lang="pa" className="font-gurmukhi text-lg text-ink leading-relaxed">{line.gurmukhi}</p>
            {line.translation && <p lang="en" className="text-ink-muted italic">{line.translation}</p>}
            <p className="text-xs text-ink-muted">{meta.join(' · ')}</p>
            {isSggsAng(line) && <AngLink ang={line.ang as number} />}
        </div>
    );
}

function CitationItem({ citation }: { citation: Citation }) {
    const { t } = useLanguage();
    const c = t.chat.citations;
    const { Icon, tone } = STATUS[citation.status];
    const { line } = citation;

    return (
        <li className="px-4 py-3 space-y-2">
            <p className={`flex items-center gap-1.5 text-xs font-bold ${tone}`}>
                <Icon className="w-4 h-4 shrink-0" aria-hidden="true" />
                {c.statusLabels[citation.status]}
            </p>

            {(citation.status === 'verified' || citation.status === 'wrong-ang') && line && (
                <>
                    <SourceLine line={line} />
                    {citation.status === 'wrong-ang' && citation.citedAng !== undefined && line.ang !== null && (
                        <p className="text-xs text-ink-muted">{fmt(c.wrongAngNote, { cited: citation.citedAng, ang: line.ang })}</p>
                    )}
                    {citation.status === 'verified' && citation.exact === false && (
                        <p className="text-xs text-ink-muted">{c.spellingNote}</p>
                    )}
                </>
            )}

            {citation.status === 'close' && line && (
                <>
                    <div>
                        <p className="text-[11px] uppercase tracking-wider text-ink-faint font-bold">{c.inReply}</p>
                        <p lang="pa" className="font-gurmukhi text-ink-muted line-through decoration-ink-faint/60">{citation.quote}</p>
                    </div>
                    <div>
                        <p className="text-[11px] uppercase tracking-wider text-ink-faint font-bold">{c.closestLine}</p>
                        <SourceLine line={line} />
                    </div>
                    <p className="text-xs text-ink-muted">{c.closeNote}</p>
                </>
            )}

            {citation.status === 'unverified' && (
                <>
                    {/* The reply's own words, labelled as such: the box's footer
                        says its lines come from GurbaniNow. */}
                    <div>
                        <p className="text-[11px] uppercase tracking-wider text-ink-faint font-bold">{c.inReply}</p>
                        <p lang="pa" className="font-gurmukhi text-ink-muted">{citation.quote}</p>
                    </div>
                    <p className="text-xs text-ink-muted">{c.unverifiedNote}</p>
                    {citation.citedAng !== undefined && <AngLink ang={citation.citedAng} />}
                </>
            )}
        </li>
    );
}

export default function Citations({ citations }: { citations: unknown }) {
    const { t } = useLanguage();
    // Re-checked here: messages come back from localStorage, which anything
    // on the page could have written.
    const list = useMemo(() => sanitizeCitations(citations), [citations]);
    if (list.length === 0) return null;
    return (
        <aside
            aria-label={t.chat.citations.heading}
            className="max-w-[85%] md:max-w-[75%] w-full mt-2 rounded-xl border border-edge bg-surface-raised text-sm"
        >
            <p className="px-4 pt-3 text-[11px] uppercase tracking-widest text-ink-faint font-bold">{t.chat.citations.heading}</p>
            <ul className="divide-y divide-edge">
                {list.map((citation, i) => <CitationItem key={`${i}:${citation.quote}`} citation={citation} />)}
            </ul>
            <p className="px-4 py-2 border-t border-edge text-xs text-ink-muted">{t.chat.citations.sourceNote}</p>
        </aside>
    );
}
