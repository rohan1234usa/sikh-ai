'use client';

import { useEffect, useRef, useState } from 'react';
import { useT } from '../../context/LanguageContext';
import { fmt } from '@/lib/i18n/fmt';
import type {
    CrosscheckDirection,
    CrosscheckResponse,
    DetectedInput,
    TranslationResult,
} from '@/lib/translate/config';
import CopyButton from './CopyButton';

type CrossState =
    | { status: 'idle' }
    | { status: 'loading' }
    | { status: 'error' }
    | { status: 'done'; text: string };

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

    const [cross, setCross] = useState<CrossState>({ status: 'idle' });
    const crossAbortRef = useRef<AbortController | null>(null);

    // A new result invalidates any comparison on screen. Living in component
    // state (never in `result`) is what keeps the cross-check out of history.
    useEffect(() => {
        crossAbortRef.current?.abort();
        setCross({ status: 'idle' });
        return () => crossAbortRef.current?.abort();
    }, [result]);

    // Always send Cloud Translation a rendition it can actually read. For
    // romanized input that means Gemini's Gurmukhi — which is also the more
    // useful check, since it compares the two engines' English side by side.
    const crossToGurmukhi = result.detectedInput === 'english';
    const crossDirection: CrosscheckDirection = crossToGurmukhi ? 'en-pa' : 'pa-en';
    const crossSource = crossToGurmukhi ? result.english : result.gurmukhi;

    const runCrosscheck = async () => {
        crossAbortRef.current?.abort();
        const controller = new AbortController();
        crossAbortRef.current = controller;
        setCross({ status: 'loading' });
        try {
            const res = await fetch('/api/translate/crosscheck', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ text: crossSource, direction: crossDirection }),
                signal: controller.signal,
            });
            if (!res.ok) throw new Error('crosscheck failed');
            const data = await res.json() as CrosscheckResponse;
            if (!data?.translatedText) throw new Error('empty');
            setCross({ status: 'done', text: data.translatedText });
        } catch (err) {
            if (err instanceof DOMException && err.name === 'AbortError') return;
            setCross({ status: 'error' });
        }
    };

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
        // A Cloud Translation fallback has no roman rendition — dropping empty
        // entries here also keeps copy-all from emitting a blank line.
    ].filter(r => r.text !== '');

    return (
        <div className="bg-surface-raised rounded-xl border border-edge shadow-sm p-4 sm:p-6">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mb-4">
                <span className="text-xs uppercase tracking-widest text-accent-text font-bold">
                    {fmt(t.translate.translatedAs, { label: t.translate.inputKinds[result.detectedInput] })}
                </span>
                {/* Hidden on a fallback result: "reinterpret as Roman Punjabi" is
                    exactly the case Cloud Translation has to refuse, so the retry
                    could only ever come back as an error. */}
                {onRetryAs && !result.fallback && (
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

            {result.fallback && (
                <p className="mb-4 rounded-lg border border-edge bg-surface px-3 py-2 text-xs text-ink-muted">
                    {t.translate.fallbackNotice}
                </p>
            )}

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

            {/* Comparing a Google result against Google would say nothing. */}
            {!result.fallback && (
                <div className="mt-4 pt-3 border-t border-edge">
                    {cross.status === 'done' ? (
                        <div className="flex items-start gap-2">
                            <div className="flex-1 min-w-0">
                                <p className="text-xs uppercase tracking-widest text-ink-faint mb-1">
                                    {t.translate.crosscheckLabel}
                                </p>
                                <p
                                    lang={crossToGurmukhi ? 'pa' : 'en'}
                                    className={crossToGurmukhi
                                        ? 'font-gurmukhi text-xl text-ink leading-relaxed'
                                        : 'text-ink-muted'}
                                >
                                    {cross.text}
                                </p>
                            </div>
                            <CopyButton
                                text={cross.text}
                                ariaLabel={fmt(t.translate.copyAria, { label: t.translate.crosscheckLabel })}
                            />
                        </div>
                    ) : (
                        <div className="flex items-center gap-3">
                            <button
                                type="button"
                                onClick={runCrosscheck}
                                disabled={cross.status === 'loading'}
                                className="text-xs text-ink-faint hover:text-ink underline underline-offset-2 transition-colors disabled:no-underline"
                            >
                                {cross.status === 'loading' ? t.translate.crosschecking : t.translate.crosscheck}
                            </button>
                            {/* Inline, never the page-level alert: a failed comparison
                                must not look like a failed translation. */}
                            {cross.status === 'error' && (
                                <span className="text-xs text-red-600 dark:text-red-400">
                                    {t.translate.crosscheckError}
                                </span>
                            )}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
