'use client';

import { useState } from 'react';
import Link from 'next/link';
import { BookOpenIcon, ChatBubbleLeftRightIcon } from '@heroicons/react/24/outline';
import { useT } from '../../context/LanguageContext';
import { fmt } from '@/lib/i18n/fmt';
import type { Level, ShabadMatch } from '@/lib/identify/config';

type Props = { match: ShabadMatch };

// Confidence tones come from the existing semantic tokens: kesri for the one
// answer we stand behind, progressively quieter for the ones we don't.
const CONFIDENCE_STYLES: Record<Level, string> = {
    high: 'bg-accent-text/10 text-accent-text',
    medium: 'bg-edge text-ink-muted',
    low: 'border border-edge text-ink-faint',
};

export default function MatchCard({ match }: Props) {
    const t = useT();
    const [showFull, setShowFull] = useState(false);

    // Every Gurmukhi string needs lang + font-gurmukhi explicitly: the body
    // font only switches to a Gurmukhi stack when the whole UI is in Punjabi.
    const gurmukhiClass = 'font-gurmukhi text-ink';
    const meta = [match.writer, match.raag, match.source].filter(Boolean);

    return (
        <article className="bg-surface-raised p-4 sm:p-6 rounded-xl shadow-sm border border-edge">
            <div className="flex items-start justify-between gap-3 mb-4">
                <span className={`shrink-0 rounded-full px-3 py-1 text-xs font-semibold ${CONFIDENCE_STYLES[match.confidence]}`}>
                    {t.identify.confidenceLabels[match.confidence]}
                </span>
                <span className="text-xs text-ink-faint text-right">
                    {match.ang === null ? t.identify.angUnknown : fmt(t.identify.ang, { n: match.ang })}
                </span>
            </div>

            <p lang="pa" className={`${gurmukhiClass} text-2xl md:text-3xl font-bold text-center leading-relaxed mb-3`}>
                {match.verse.gurmukhi}
            </p>

            {match.verse.transliteration && (
                <p className="text-center text-sm text-ink-faint italic mb-2">
                    {match.verse.transliteration}
                </p>
            )}

            {match.verse.translation && (
                <p lang="en" className="text-center text-ink-muted italic mb-4">
                    {match.verse.translation}
                </p>
            )}

            {meta.length > 0 && (
                <p className="text-xs text-ink-faint text-center border-t border-edge pt-3">
                    {meta.join(' · ')}
                </p>
            )}

            {/* Both deep links need an Ang, so a match without one shows the
                verse and stops there rather than linking somewhere useless. */}
            {match.ang !== null && (
                <div className="flex flex-wrap justify-center gap-x-5 gap-y-2 mt-4 text-sm font-semibold">
                    <Link
                        href={`/shabad?ang=${match.ang}`}
                        className="inline-flex items-center gap-1.5 text-accent-text hover:underline"
                    >
                        <BookOpenIcon className="w-4 h-4" aria-hidden="true" />
                        {t.identify.openAng}
                    </Link>
                    <Link
                        href={`/chat?context=shabad&ang=${match.ang}`}
                        className="inline-flex items-center gap-1.5 text-accent-text hover:underline"
                    >
                        <ChatBubbleLeftRightIcon className="w-4 h-4" aria-hidden="true" />
                        {t.identify.askAbout}
                    </Link>
                </div>
            )}

            {/* Only the top match carries its full text, and only when the
                verification fetch succeeded. */}
            {match.fullShabad && match.fullShabad.length > 0 && (
                <div className="mt-4 pt-4 border-t border-edge">
                    <button
                        type="button"
                        onClick={() => setShowFull(v => !v)}
                        aria-expanded={showFull}
                        className="w-full text-sm font-semibold text-accent-text hover:underline"
                    >
                        {showFull ? t.identify.hideFullShabad : t.identify.showFullShabad}
                    </button>
                    {showFull && (
                        <div className="mt-4 space-y-4">
                            <h4 className="text-xs uppercase tracking-widest text-ink-faint text-center">
                                {t.identify.fullShabadTitle}
                            </h4>
                            {match.fullShabad.map((line, i) => (
                                <div key={i}>
                                    <p lang="pa" className={`${gurmukhiClass} text-lg text-center leading-relaxed`}>
                                        {line.gurmukhi}
                                    </p>
                                    {line.translation && (
                                        <p lang="en" className="text-center text-sm text-ink-faint italic mt-1">
                                            {line.translation}
                                        </p>
                                    )}
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}
        </article>
    );
}
