'use client';

import { useT } from '../../context/LanguageContext';
import type { Dictionary } from '@/lib/i18n';
import type { IdentifyResult, IdentifyStatus, Transcription } from '@/lib/identify/config';
import MatchCard from './MatchCard';

type Props = {
    result: IdentifyResult;
    onTryAgain: () => void;
};

// What was heard, shown for every outcome including the failures. It is the
// one piece of evidence the user can judge for themselves: if the transcription
// is wrong, they know to record again rather than doubting the whole tool.
function HeardCard({ heard }: { heard: Transcription }) {
    const t = useT();
    return (
        <section className="bg-surface-raised rounded-xl border border-edge shadow-sm p-4 sm:p-6">
            <h2 className="text-xs uppercase tracking-widest text-ink-faint mb-3">
                {t.identify.weHeard}
            </h2>
            <div className="space-y-3">
                {heard.lines.map((line, i) => (
                    <div key={i}>
                        {/* Low-confidence lines are dimmed rather than hidden —
                            a half-heard line is still a clue to the reader. */}
                        <p
                            lang="pa"
                            className={`font-gurmukhi text-xl leading-relaxed ${
                                line.confidence === 'low' ? 'text-ink-faint' : 'text-ink'
                            }`}
                        >
                            {line.gurmukhi}
                        </p>
                        {line.roman && (
                            <p className="text-sm text-ink-faint italic mt-0.5">{line.roman}</p>
                        )}
                    </div>
                ))}
            </div>
            <p className="text-xs text-ink-faint mt-4">{t.identify.weHeardNote}</p>
        </section>
    );
}

function Tips() {
    const t = useT();
    return (
        <div className="mt-4 text-left inline-block">
            <h4 className="text-sm font-semibold text-ink mb-2">{t.identify.tipsTitle}</h4>
            <ul className="text-sm text-ink-muted space-y-1 list-disc list-inside">
                <li>{t.identify.tipCloser}</li>
                <li>{t.identify.tipLonger}</li>
                <li>{t.identify.tipQuiet}</li>
            </ul>
        </div>
    );
}

// Copy for every outcome that is not a match. These are findings, not errors:
// the tool listened and reports what it concluded. Tips are offered only where
// they would help — a clearer recording cannot turn English speech into Gurbani.
function outcomeCopy(t: Dictionary): Record<Exclude<IdentifyStatus, 'matched'>, { title: string; body: string; tips: boolean }> {
    return {
        no_match: { title: t.identify.noMatchTitle, body: t.identify.noMatchBody, tips: true },
        no_speech: { title: t.identify.noSpeechTitle, body: t.identify.noSpeechBody, tips: true },
        not_gurbani: { title: t.identify.notGurbaniTitle, body: t.identify.notGurbaniBody, tips: false },
        search_unavailable: {
            title: t.identify.searchUnavailableTitle,
            body: t.identify.searchUnavailableBody,
            tips: false,
        },
    };
}

export default function IdentifyResults({ result, onTryAgain }: Props) {
    const t = useT();
    const { status, heard, matches } = result;

    const tryAgainButton = (
        <button
            type="button"
            onClick={onTryAgain}
            className="mt-5 bg-navy text-white font-semibold px-6 py-2.5 rounded-xl hover:bg-kesri hover:text-navy transition-colors"
        >
            {t.identify.tryAgain}
        </button>
    );

    if (status !== 'matched') {
        const copy = outcomeCopy(t)[status];
        return (
            <div className="space-y-6">
                {heard && heard.lines.length > 0 && <HeardCard heard={heard} />}
                <div className="text-center py-6">
                    <h3 className="text-lg font-bold text-ink">{copy.title}</h3>
                    <p className="mt-2 text-ink-muted max-w-md mx-auto">{copy.body}</p>
                    {copy.tips && <Tips />}
                    <div>{tryAgainButton}</div>
                </div>
            </div>
        );
    }

    const topConfidence = matches[0]?.confidence;
    const anyAmbiguous = matches.some(m => m.ambiguous);

    return (
        <div className="space-y-6">
            {heard && heard.lines.length > 0 && <HeardCard heard={heard} />}

            <div>
                <h2 className="text-ink font-bold mb-3">{t.identify.matchesTitle}</h2>

                {/* Said once above the list rather than repeated per card: the
                    caveat is about the answer as a whole. */}
                {anyAmbiguous && (
                    <p className="mb-4 text-sm text-ink-muted bg-edge/40 border border-edge rounded-lg px-4 py-3">
                        {t.identify.ambiguousNote}
                    </p>
                )}
                {!anyAmbiguous && topConfidence === 'low' && (
                    <p className="mb-4 text-sm text-ink-muted bg-edge/40 border border-edge rounded-lg px-4 py-3">
                        {t.identify.lowConfidenceNote}
                    </p>
                )}

                <div className="space-y-4">
                    {matches.map(match => (
                        <MatchCard key={match.shabadId} match={match} />
                    ))}
                </div>
            </div>

            <div className="text-center">{tryAgainButton}</div>
        </div>
    );
}
