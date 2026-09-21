'use client';

import { useEffect, useRef, useState } from 'react';
import { useT } from '../context/LanguageContext';
import { FriendlyError, responseErrorText } from '@/lib/i18n/apiError';
import {
  MAX_TRANSLATE_CHARS,
  type DetectedInput,
  type SourceHint,
  type TranslationResult,
} from '@/lib/translate/config';
import { detectScript } from '@/lib/translate/detect';
import { sameRequest } from '@/lib/translate/history';
import type { Phrase } from '@/lib/translate/phrasebook';
import { loadPhraseResult } from '@/lib/translate/phrasebookResults';
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
  // The request behind the result on screen, so submitting it unchanged can
  // mean "translate again" rather than "show me the saved answer".
  const [shown, setShown] = useState<{ input: string; sourceHint: SourceHint } | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  // Bumped by every new request, so a slow one can tell it has been replaced.
  const requestSeqRef = useRef(0);
  const resultRegionRef = useRef<HTMLDivElement>(null);
  // The text that produced the current result — "Not right?" re-runs this
  // even if the textarea has been edited since.
  const lastSubmittedRef = useRef('');
  const history = useTranslateHistory();

  // Word order around the highlighted word differs per language, so split the
  // template on {word} and render the styled span between the halves.
  const [titleBefore, titleAfter] = t.translate.title.split('{word}');

  useEffect(() => () => abortRef.current?.abort(), []);

  // Puts a result on screen and records the request that produced it.
  const show = (input: string, sourceHint: SourceHint, shownResult: TranslationResult) => {
    lastSubmittedRef.current = input;
    setShown({ input, sourceHint });
    setResult(shownResult);
    setError('');
    setWasAutoLatin(sourceHint === 'auto' && detectScript(input) === 'latin');
  };

  const translate = async (rawText: string, sourceHint: SourceHint, fresh = false) => {
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
    const seq = ++requestSeqRef.current;

    // The same request answered before is shown again for free — unless the
    // user asked for a fresh one ("Translate again").
    const cached = fresh ? undefined : history.lookup(trimmed, sourceHint);
    if (cached) {
      abortRef.current?.abort();
      show(trimmed, sourceHint, cached.result);
      history.add({ input: trimmed, sourceHint, result: cached.result });
      return;
    }

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
      // A rate limiter or proxy in front of the API can answer with HTML, so
      // an unparseable body must not surface as a raw SyntaxError.
      const data = await res.json().catch(() => null);

      if (!res.ok || !data) {
        throw new FriendlyError(responseErrorText(t, res, data, 'translate_busy'));
      }
      if (seq !== requestSeqRef.current) return;

      const parsed = data as TranslationResult;
      show(trimmed, sourceHint, parsed);
      history.add({ input: trimmed, sourceHint, result: parsed });
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') return;
      console.error(err);
      setError(err instanceof FriendlyError ? err.message : t.errors.generic);
    } finally {
      if (abortRef.current === controller) setLoading(false);
    }
  };

  // Submitting exactly what is already on screen means "do it again".
  const showingThis = result !== null && shown !== null && sameRequest(shown, { input: text, sourceHint: hint });
  const handleSubmit = () => translate(text, hint, showingThis);

  const handleRetryAs = (as: DetectedInput) => translate(lastSubmittedRef.current, as);

  // The phrasebook and history sit below the results, so a selection there
  // changes content a viewport or two up with nothing to show for it locally.
  const revealResults = () => {
    resultRegionRef.current?.focus();
    resultRegionRef.current?.scrollIntoView({ block: 'start' });
  };

  // Curated phrases ship with results generated ahead of time (npm run
  // build:phrasebook): shown instantly, no request, and still there when
  // Gemini is not. A phrase without one falls back to the API. Phrasebook rows
  // are known romanized Punjabi, so that is the hint; the user's chip
  // preference is left untouched.
  const handleUsePhrase = async (phrase: Phrase) => {
    setText(phrase.roman);
    setHint('punjabi-latin'); // as for a history entry: the chip matches the result
    revealResults();
    const seq = ++requestSeqRef.current;
    const stored = await loadPhraseResult(phrase);
    if (seq !== requestSeqRef.current) return; // something newer started meanwhile
    if (!stored) {
      translate(phrase.roman, 'punjabi-latin');
      return;
    }
    abortRef.current?.abort();
    setLoading(false);
    show(phrase.roman, 'punjabi-latin', stored);
    history.add({ input: phrase.roman, sourceHint: 'punjabi-latin', result: stored });
  };

  // Restoring from history is free — the full stored result is re-displayed
  // with no API call. The aria-live region announces it like a fresh result.
  const handleHistorySelect = (entry: TranslateHistoryEntry) => {
    abortRef.current?.abort();
    ++requestSeqRef.current;
    setText(entry.input);
    setLoading(false);
    // Restore the chip too, so it can't sit on a value that contradicts the
    // result being shown.
    setHint(entry.sourceHint);
    show(entry.input, entry.sourceHint, entry.result);
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
          again={showingThis}
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
                onRetry={() => translate(lastSubmittedRef.current, shown?.sourceHint ?? hint)}
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
