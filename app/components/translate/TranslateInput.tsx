'use client';

import { useT } from '../../context/LanguageContext';
import { fmt } from '@/lib/i18n/fmt';
import { MAX_TRANSLATE_CHARS, SOURCE_HINTS, type SourceHint } from '@/lib/translate/config';
import { detectScript } from '@/lib/translate/detect';

type Props = {
    text: string;
    onText: (value: string) => void;
    hint: SourceHint;
    onHint: (hint: SourceHint) => void;
    loading: boolean;
    onSubmit: () => void;
};

// Input card for the navy page header: textarea + source-hint chips + the
// live "Detected:" helper line driven by the client-side script heuristic.
export default function TranslateInput({ text, onText, hint, onHint, loading, onSubmit }: Props) {
    const t = useT();

    const chipLabels: Record<SourceHint, string> = {
        'auto': t.translate.sourceAuto,
        'english': t.translate.sourceEnglish,
        'punjabi-gurmukhi': t.translate.sourceGurmukhi,
        'punjabi-latin': t.translate.sourceRoman,
    };

    const hasText = text.trim() !== '';
    const nearCap = text.length >= MAX_TRANSLATE_CHARS * 0.8;
    const overCap = text.length > MAX_TRANSLATE_CHARS;

    return (
        <form
            onSubmit={(e) => { e.preventDefault(); onSubmit(); }}
            className="w-full max-w-xl"
        >
            <div className="bg-white rounded-xl shadow-xl p-3">
                <textarea
                    rows={3}
                    aria-label={t.translate.inputAria}
                    value={text}
                    onChange={(e) => onText(e.target.value)}
                    onKeyDown={(e) => {
                        if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
                            e.preventDefault();
                            onSubmit();
                        }
                    }}
                    placeholder={t.translate.inputPlaceholder}
                    className="w-full resize-none p-2 text-navy bg-white rounded-lg outline-none border-2 border-transparent focus:border-kesri transition-all placeholder:text-slate-400"
                />
                <div className="flex items-center justify-between gap-3 pt-2 border-t border-slate-200">
                    <span
                        aria-hidden={!nearCap}
                        className={`text-xs ${overCap ? 'text-red-600 font-semibold' : 'text-slate-500'} ${nearCap ? '' : 'invisible'}`}
                    >
                        {fmt(t.translate.charCount, { n: text.length, max: MAX_TRANSLATE_CHARS })}
                    </span>
                    <button
                        type="submit"
                        disabled={loading || !hasText}
                        className="bg-navy text-white px-6 py-2 rounded-lg font-bold hover:bg-kesri hover:text-navy transition disabled:opacity-60 disabled:hover:bg-navy disabled:hover:text-white"
                    >
                        {loading ? t.translate.translating : t.translate.translateButton}
                    </button>
                </div>
            </div>

            <div role="group" aria-label={t.translate.sourceChipsAria} className="mt-3 flex flex-wrap justify-center gap-2">
                {SOURCE_HINTS.map(id => (
                    <button
                        key={id}
                        type="button"
                        onClick={() => onHint(id)}
                        aria-pressed={hint === id}
                        className={`px-3 py-1 rounded-full text-sm transition-colors ${hint === id
                            ? 'bg-kesri text-navy font-semibold'
                            : 'bg-white/10 text-slate-200 hover:bg-white/20'}`}
                    >
                        {chipLabels[id]}
                    </button>
                ))}
            </div>

            {hint === 'auto' && hasText && (
                <p className="mt-3 text-xs text-slate-300 text-center" aria-live="polite">
                    {detectScript(text) === 'gurmukhi'
                        ? t.translate.detectedGurmukhi
                        : t.translate.detectedLatin}
                </p>
            )}
        </form>
    );
}
