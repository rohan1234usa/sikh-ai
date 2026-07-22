'use client';

import { useT } from '../../context/LanguageContext';
import { fmt } from '@/lib/i18n/fmt';
import type { DetectedInput, TranslationResult } from '@/lib/translate/config';
import CopyButton from './CopyButton';

type Props = {
    result: TranslationResult;
    // Provided only when the request was auto-detected Latin input — the one
    // genuinely error-prone case ("main street" vs "main theek haan"). The
    // link re-submits the same text with the opposite explicit hint.
    onRetryAs?: (hint: DetectedInput) => void;
};

export default function TranslationCard({ result, onRetryAs }: Props) {
    const t = useT();
    const retryHint: DetectedInput =
        result.detectedInput === 'english' ? 'punjabi-latin' : 'english';

    const renditions = [
        {
            key: 'gurmukhi',
            label: t.translate.gurmukhiLabel,
            text: result.gurmukhi,
            lang: 'pa',
            className: 'font-gurmukhi text-2xl md:text-3xl text-ink leading-relaxed',
        },
        {
            key: 'roman',
            label: t.translate.romanLabel,
            text: result.roman,
            lang: 'pa-Latn',
            className: 'text-lg text-ink',
        },
        {
            key: 'english',
            label: t.translate.englishLabel,
            text: result.english,
            lang: 'en',
            className: 'text-ink-muted',
        },
    ];

    return (
        <div className="bg-surface-raised rounded-xl border border-edge shadow-sm p-4 sm:p-6">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mb-4">
                <span className="text-xs uppercase tracking-widest text-accent-text font-bold">
                    {fmt(t.translate.translatedAs, { label: t.translate.inputKinds[result.detectedInput] })}
                </span>
                {onRetryAs && (
                    <button
                        type="button"
                        onClick={() => onRetryAs(retryHint)}
                        className="text-xs text-ink-faint hover:text-ink underline underline-offset-2 transition-colors"
                    >
                        {fmt(t.translate.retryAs, { label: t.translate.inputKinds[retryHint] })}
                    </button>
                )}
                <span className="ml-auto">
                    <CopyButton
                        text={renditions.map(r => r.text).join('\n')}
                        ariaLabel={t.translate.copyAll}
                    />
                </span>
            </div>

            <div className="divide-y divide-edge">
                {renditions.map(r => (
                    <div key={r.key} className="py-3 first:pt-0 last:pb-0 flex items-start gap-2">
                        <div className="flex-1 min-w-0">
                            <p className="text-xs uppercase tracking-widest text-ink-faint mb-1">{r.label}</p>
                            <p lang={r.lang} className={r.className}>{r.text}</p>
                        </div>
                        <CopyButton text={r.text} ariaLabel={fmt(t.translate.copyAria, { label: r.label })} />
                    </div>
                ))}
            </div>
        </div>
    );
}
