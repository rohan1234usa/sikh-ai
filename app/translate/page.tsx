'use client';

import { useEffect, useRef, useState } from 'react';
import { useT } from '../context/LanguageContext';
import { apiErrorText } from '@/lib/i18n/apiError';
import {
  MAX_TRANSLATE_CHARS,
  type DetectedInput,
  type SourceHint,
  type TranslationResult,
} from '@/lib/translate/config';
import { detectScript } from '@/lib/translate/detect';
import type { Phrase } from '@/lib/translate/phrasebook';
import TranslateInput from '../components/translate/TranslateInput';
import TranslationCard from '../components/translate/TranslationCard';
import WordBreakdown from '../components/translate/WordBreakdown';
import TrickyNotes from '../components/translate/TrickyNotes';
import PronunciationTips from '../components/translate/PronunciationTips';
import TranslateSkeleton from '../components/translate/TranslateSkeleton';
import Phrasebook from '../components/translate/Phrasebook';
import TranslateHistory from '../components/translate/TranslateHistory';
import { useTranslateHistory, type TranslateHistoryEntry } from '../components/translate/useTranslateHistory';

export default function TranslatePage() {
  const t = useT();
  const [text, setText] = useState('');
  const [hint, setHint] = useState<SourceHint>('auto');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<TranslationResult | null>(null);
  // True when the shown result came from auto-detected Latin input — the only
  // case where the corrective "translate as X" link is offered.
  const [wasAutoLatin, setWasAutoLatin] = useState(false);
  const [error, setError] = useState('');
  const abortRef = useRef<AbortController | null>(null);
  const resultRegionRef = useRef<HTMLDivElement>(null);
  // The text that produced the current result — "Not right?" re-runs this
  // even if the textarea has been edited since.
  const lastSubmittedRef = useRef('');
  const history = useTranslateHistory();

  // Word order around the highlighted word differs per language, so split the
  // template on {word} and render the styled span between the halves.
  const [titleBefore, titleAfter] = t.translate.title.split('{word}');

  useEffect(() => () => abortRef.current?.abort(), []);

  const translate = async (rawText: string, sourceHint: SourceHint) => {
    const trimmed = rawText.trim();
    if (!trimmed) {
      setError(t.errors.translate_empty);
      return;
    }
    if (trimmed.length > MAX_TRANSLATE_CHARS) {
      setError(t.errors.translate_too_long);
      return;
    }
    // The submit button is disabled while loading, but the phrasebook and the
    // Ctrl/Cmd+Enter shortcut both call in directly. Aborting a request does
    // not un-bill it, so drop the extra call rather than racing it.
    if (loading) return;

    // Abort any in-flight request; the guard in `finally` keeps the stale
    // request's cleanup from clobbering this one's loading state.
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    lastSubmittedRef.current = trimmed;

    setLoading(true);
    setError('');
    setResult(null);

    try {
      const res = await fetch('/api/translate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: trimmed, sourceHint }),
        signal: controller.signal,
      });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(apiErrorText(t, data) ?? t.errors.generic);
      }

      const parsed = data as TranslationResult;
      setResult(parsed);
      setWasAutoLatin(sourceHint === 'auto' && detectScript(trimmed) === 'latin');
      history.add({ input: trimmed, sourceHint, result: parsed });
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') return;
      console.error(err);
      setError(err instanceof Error && err.message ? err.message : t.errors.generic);
    } finally {
      if (abortRef.current === controller) setLoading(false);
    }
  };

  const handleSubmit = () => translate(text, hint);

  const handleRetryAs = (as: DetectedInput) => translate(lastSubmittedRef.current, as);

  // The phrasebook and history sit below the results, so a selection there
  // changes content a viewport or two up with nothing to show for it locally.
  const revealResults = () => {
    resultRegionRef.current?.focus();
    resultRegionRef.current?.scrollIntoView({ block: 'start' });
  };

  // Phrasebook rows are known romanized Punjabi, so the request carries the
  // explicit hint; the user's chip preference is left untouched.
  const handleUsePhrase = (phrase: Phrase) => {
    setText(phrase.roman);
    translate(phrase.roman, 'punjabi-latin');
    revealResults();
  };

  // Restoring from history is free — the full stored result is re-displayed
  // with no API call. The aria-live region announces it like a fresh result.
  const handleHistorySelect = (entry: TranslateHistoryEntry) => {
    abortRef.current?.abort();
    setText(entry.input);
    lastSubmittedRef.current = entry.input;
    setResult(entry.result);
    setError('');
    setLoading(false);
    // Restore the chip too, so it can't sit on a value that contradicts the
    // result being shown.
    setHint(entry.sourceHint);
    setWasAutoLatin(entry.sourceHint === 'auto' && detectScript(entry.input) === 'latin');
    revealResults();
  };

  return (
    <main className="flex-1 flex flex-col">

      {/* Input Header */}
      <div className="bg-navy text-white py-12 px-6 flex flex-col items-center">
        <h1 className="text-3xl font-bold mb-2 text-center">
          {titleBefore}<span className="text-kesri">{t.translate.titleWord}</span>{titleAfter}
        </h1>
        <p className="mb-6 text-sm text-slate-300 text-center max-w-xl">
          {t.translate.subtitle}
        </p>
        <TranslateInput
          text={text}
          onText={setText}
          hint={hint}
          onHint={setHint}
          loading={loading}
          onSubmit={handleSubmit}
        />
      </div>

      {/* Results Area */}
      <div className="max-w-3xl mx-auto w-full p-6 flex-1 space-y-10">

        <div
          ref={resultRegionRef}
          tabIndex={-1}
          role="region"
          aria-label={t.translate.resultRegionAria}
          aria-live="polite"
          aria-busy={loading}
          className="space-y-6 scroll-mt-20 outline-none"
        >
          {loading && <TranslateSkeleton />}

          {error && !loading && (
            <div role="alert" className="text-center py-10 text-red-600 bg-red-50 rounded-xl border border-red-100 dark:bg-red-950/40 dark:text-red-400 dark:border-red-900">
              {error}
            </div>
          )}

          {result && !loading && !error && (
            <>
              <TranslationCard
                result={result}
                onRetryAs={wasAutoLatin ? handleRetryAs : undefined}
                onRetry={() => translate(lastSubmittedRef.current, hint)}
              />
              <WordBreakdown words={result.words} />
              <TrickyNotes notes={result.notes} />
              <PronunciationTips tips={result.pronunciation} />
            </>
          )}

          {!result && !loading && !error && (
            <p className="text-center py-10 text-ink-faint">{t.translate.emptyState}</p>
          )}
        </div>

        <TranslateHistory
          entries={history.entries}
          hydrated={history.hydrated}
          onSelect={handleHistorySelect}
          onRemove={history.remove}
          onClear={history.clear}
        />

        <Phrasebook onUsePhrase={handleUsePhrase} />
      </div>

    </main>
  );
}
