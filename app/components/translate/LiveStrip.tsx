'use client';

import { useT } from '../../context/LanguageContext';
import { liveFieldsFor, type LiveField } from '@/lib/translate/live';
import type { LiveView } from './useLiveTranslate';

// The live lines, inside the input card under the text box: the
// translation only, never the input echoed back (liveFieldsFor). Not a live
// region: announcing every pause's lines would talk over someone typing.
// The full result below is announced as before.
export default function LiveStrip({ view }: { view: LiveView }) {
    const t = useT();
    const { status, lines, stale } = view;
    if (status === 'off' || status === 'short') return null;

    const labels: Record<LiveField, string> = {
        gurmukhi: t.translate.gurmukhiLabel,
        roman: t.translate.romanLabel,
        english: t.translate.englishLabel,
    };
    const styles: Record<LiveField, { lang: string; className: string }> = {
        gurmukhi: { lang: 'pa', className: 'font-gurmukhi text-lg leading-relaxed' },
        roman: { lang: 'pa-Latn', className: '' },
        english: { lang: 'en', className: 'text-slate-600' },
    };
    // A line still to come while streaming; one that never came once done.
    const finished = status === 'done' || status === 'cut';

    const note =
        status === 'long' ? t.translate.liveTooLong
            : status === 'paused' ? t.translate.livePaused
                : status === 'failed' ? t.translate.liveFailed
                    : status === 'cut' ? t.translate.liveCut
                        : null;

    return (
        <div
            role="group"
            aria-label={t.translate.liveAria}
            aria-busy={status === 'waiting' || status === 'streaming'}
            className="mx-2 mb-2 border-t border-slate-200 pt-2 text-left"
        >
            <p className="flex items-center gap-1.5 text-[11px] uppercase tracking-widest text-slate-500">
                <span
                    aria-hidden
                    className={`inline-block size-1.5 rounded-full ${status === 'waiting' || status === 'streaming'
                        ? 'bg-kesri motion-safe:animate-pulse'
                        : 'bg-slate-300'}`}
                />
                {t.translate.liveLabel}
            </p>
            {lines && (
                <dl className={`mt-1 space-y-0.5 text-navy transition-opacity ${stale ? 'opacity-50' : ''}`}>
                    {liveFieldsFor(lines.input).map(field => {
                        const text = lines[field];
                        if (!text && !finished) return null;
                        return (
                            <div key={field} className="flex items-baseline gap-2">
                                <dt className="sr-only">{labels[field]}</dt>
                                <dd lang={text ? styles[field].lang : undefined} className={`min-w-0 break-words ${text ? styles[field].className : 'text-sm italic text-slate-400'}`}>
                                    {text || t.translate.liveMissing}
                                </dd>
                            </div>
                        );
                    })}
                </dl>
            )}
            {note && <p className="mt-1 text-xs text-slate-500">{note}</p>}
        </div>
    );
}
