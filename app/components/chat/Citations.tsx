'use client';

import { useId, useMemo } from 'react';
import Link from 'next/link';
import { ArrowTopRightOnSquareIcon, CheckBadgeIcon, ExclamationTriangleIcon, QuestionMarkCircleIcon } from '@heroicons/react/24/outline';
import { useLanguage } from '../../context/LanguageContext';
import { fmt } from '@/lib/i18n/fmt';
import { MAX_ANG, MAX_CITATIONS, SGGS_SOURCE_ID, sanitizeCitations, type Citation, type CitationLine } from '@/lib/gurbani/citations';
import { extractQuotes } from '@/lib/gurbani/extract';
import { TukkLines } from '../gurbani/Tukk';

// Cards under an AI reply showing what GurbaniNow says about each line the
// reply quoted. Everything in a card's source line — the Gurmukhi, the
// translation, Ang, writer, raag — is the source's own text, never the model's.

const STATUS = {
    'verified': { Icon: CheckBadgeIcon, tone: 'text-good' },
    // Verified, but matched only once vowel signs were set aside.
    'respelled': { Icon: CheckBadgeIcon, tone: 'text-accent-text' },
    'wrong-ang': { Icon: ExclamationTriangleIcon, tone: 'text-accent-text' },
    'close': { Icon: ExclamationTriangleIcon, tone: 'text-accent-text' },
    'unverified': { Icon: QuestionMarkCircleIcon, tone: 'text-ink-muted' },
} as const;

const isSggsAng = (line: CitationLine) =>
    line.source.id === SGGS_SOURCE_ID && line.ang !== null && line.ang >= 1 && line.ang <= MAX_ANG;

function AngLink({ ang }: { ang: number }) {
    const { t, href } = useLanguage();
    return (
        <Link
            href={href(`/shabad/${ang}`)}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-xs font-semibold text-link hover:underline"
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
            <TukkLines size="compact" gurmukhi={line.gurmukhi} translation={line.translation} />
            <p className="text-xs text-ink-muted">{meta.join(' · ')}</p>
            {isSggsAng(line) && <AngLink ang={line.ang as number} />}
        </div>
    );
}

function CitationItem({ citation }: { citation: Citation }) {
    const { t } = useLanguage();
    const c = t.chat.citations;
    // The match ignores vowel signs, but in Gurbani a lagan matra can change
    // the meaning (ਮਨੁ / ਮਨਿ), so a quote that is not letter-perfect never
    // reads as a plain match.
    const respelled = citation.status === 'verified' && citation.exact === false;
    const { Icon, tone } = STATUS[respelled ? 'respelled' : citation.status];
    const { line } = citation;

    return (
        <li className="space-y-2 pl-1">
            <p className={`flex items-center gap-1.5 text-xs font-bold ${tone}`}>
                <Icon className="w-4 h-4 shrink-0" aria-hidden="true" />
                {respelled ? c.respelled : c.statusLabels[citation.status]}
            </p>

            {(citation.status === 'verified' || citation.status === 'wrong-ang') && line && (
                <>
                    <SourceLine line={line} />
                    {citation.status === 'wrong-ang' && citation.citedAng !== undefined && line.ang !== null && (
                        <p className="text-xs text-ink-muted">{fmt(c.wrongAngNote, { cited: citation.citedAng, ang: line.ang })}</p>
                    )}
                    {respelled && <p className="text-xs text-ink-muted">{c.spellingNote}</p>}
                </>
            )}

            {citation.status === 'close' && line && (
                <>
                    <div>
                        <p className="text-[11px] uppercase tracking-wider text-ink-muted font-bold">{c.inReply}</p>
                        <p lang="pa" className="font-gurmukhi text-ink-muted line-through decoration-ink-faint/60">{citation.quote}</p>
                    </div>
                    <div>
                        <p className="text-[11px] uppercase tracking-wider text-ink-muted font-bold">{c.closestLine}</p>
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
                        <p className="text-[11px] uppercase tracking-wider text-ink-muted font-bold">{c.inReply}</p>
                        <p lang="pa" className="font-gurmukhi text-ink-muted">{citation.quote}</p>
                    </div>
                    <p className="text-xs text-ink-muted">{c.unverifiedNote}</p>
                    {citation.citedAng !== undefined && <AngLink ang={citation.citedAng} />}
                </>
            )}
        </li>
    );
}

export default function Citations({ citations, replyText }: { citations: unknown; replyText: string }) {
    const { t } = useLanguage();
    // Re-checked here: messages come back from localStorage, which anything
    // on the page could have written.
    const list = useMemo(() => sanitizeCitations(citations), [citations]);
    // The chat checks only the first MAX_CITATIONS lines a reply quotes; the
    // rest must not pass for checked. Counted with the verifier's own
    // extractor, so the two agree on what a quote is.
    const quoted = useMemo(() => extractQuotes(replyText, { limit: Infinity }).length, [replyText]);
    const headingId = useId();
    if (list.length === 0) return null;
    // Numbered like footnotes, in a hairline frame (so the note's "this box"
    // still holds). Not marked in the reply's text: the checks follow neither
    // its order nor its exact wording (lib/gurbani/verify.ts). A labelled group
    // rather than a landmark, since every answer may have one.
    return (
        <div role="group" aria-labelledby={headingId} className="mt-4 border border-edge px-4 py-3 text-sm">
            <p id={headingId} className="text-[11px] uppercase tracking-widest text-ink-muted font-bold">{t.chat.citations.heading}</p>
            <ol className="mt-3 list-decimal space-y-4 pl-5 marker:font-semibold marker:text-accent-text">
                {list.map((citation, i) => <CitationItem key={`${i}:${citation.quote}`} citation={citation} />)}
            </ol>
            {quoted > MAX_CITATIONS && (
                <p className="mt-3 border-t border-edge pt-2 text-xs text-ink-muted">
                    {fmt(t.chat.citations.moreQuoted, { max: MAX_CITATIONS, total: quoted })}
                </p>
            )}
            <p className="mt-3 border-t border-edge pt-2 text-xs text-ink-muted">{t.chat.citations.sourceNote}</p>
        </div>
    );
}
