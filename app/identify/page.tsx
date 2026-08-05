'use client';

import { useEffect, useRef, useState } from 'react';
import { useT } from '../context/LanguageContext';
import { apiErrorText } from '@/lib/i18n/apiError';
import { fmt } from '@/lib/i18n/fmt';
import { MAX_AUDIO_BYTES, MIN_RECORD_MS, type IdentifyResult } from '@/lib/identify/config';
import RecordButton from '../components/identify/RecordButton';
import IdentifyResults from '../components/identify/IdentifyResults';
import IdentifySkeleton from '../components/identify/IdentifySkeleton';
import IdentifyHistory from '../components/identify/IdentifyHistory';
import { useIdentifyHistory, type IdentifyHistoryEntry } from '../components/identify/useIdentifyHistory';
import { useIdentifyRecorder, type MicErrorKind } from '../components/identify/useIdentifyRecorder';

export default function IdentifyPage() {
  const t = useT();
  const recorder = useIdentifyRecorder();
  const history = useIdentifyHistory();

  const [processing, setProcessing] = useState(false);
  const [result, setResult] = useState<IdentifyResult | null>(null);
  const [error, setError] = useState('');
  const abortRef = useRef<AbortController | null>(null);
  const resultRegionRef = useRef<HTMLDivElement>(null);
  // The dictionary can change mid-request when the user switches language;
  // reading it from a ref keeps an in-flight response from rendering a message
  // in the language they just left.
  const tRef = useRef(t);
  tRef.current = t;

  // Word order around the highlighted word differs per language, so split the
  // template on {word} and render the styled span between the halves.
  const [titleBefore, titleAfter] = t.identify.title.split('{word}');

  useEffect(() => () => abortRef.current?.abort(), []);

  const micErrorText = (kind: MicErrorKind): string => {
    const copy = tRef.current.identify;
    switch (kind) {
      case 'denied': return copy.micDenied;
      case 'unavailable': return copy.micUnavailable;
      case 'busy': return copy.micBusy;
      case 'unsupported': return copy.notSupported;
      default: return copy.micFailed;
    }
  };

  const identify = async (blob: Blob, durationMs: number) => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setProcessing(true);
    setError('');
    setResult(null);

    try {
      const form = new FormData();
      // The extension is cosmetic — the transcription service reads the
      // container, not the name — but a plausible one avoids upstream sniffing
      // surprises.
      form.append('audio', blob, 'recording.webm');
      form.append('durationMs', String(durationMs));

      const res = await fetch('/api/identify', {
        method: 'POST',
        body: form,
        signal: controller.signal,
      });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(apiErrorText(tRef.current, data) ?? tRef.current.errors.generic);
      }

      const parsed = data as IdentifyResult;
      setResult(parsed);
      history.add(parsed);
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') return;
      console.error(err);
      setError(err instanceof Error && err.message ? err.message : tRef.current.errors.generic);
    } finally {
      if (abortRef.current === controller) setProcessing(false);
    }
  };

  const handlePress = async () => {
    if (processing) return;

    if (recorder.status === 'recording') {
      const recording = await recorder.stop();
      if (!recording) return;

      // Three checks the browser can make for free, before spending a
      // transcription call on a clip that cannot possibly match.
      if (recorder.isTooShort(recording)) {
        setError(fmt(t.identify.tooShort, { n: Math.round(MIN_RECORD_MS / 1000) }));
        return;
      }
      if (recorder.isSilent(recording)) {
        setError(t.identify.tooQuiet);
        return;
      }
      if (recording.blob.size > MAX_AUDIO_BYTES) {
        setError(t.errors.identify_too_large);
        return;
      }

      await identify(recording.blob, recording.durationMs);
      return;
    }

    setError('');
    setResult(null);
    await recorder.start(kind => setError(micErrorText(kind)));
  };

  const handleCancel = () => {
    recorder.cancel();
    setError('');
  };

  const handleTryAgain = () => {
    setResult(null);
    setError('');
  };

  // Restoring from history is free — the stored result is re-displayed with no
  // network call. The aria-live region announces it like a fresh result.
  const handleHistorySelect = (entry: IdentifyHistoryEntry) => {
    abortRef.current?.abort();
    setResult(entry.result);
    setError('');
    setProcessing(false);
    resultRegionRef.current?.focus();
    resultRegionRef.current?.scrollIntoView({ block: 'start' });
  };

  // A blocked microphone is a property of the page, not of one attempt: it
  // shows before the user taps, and disables the button rather than letting
  // them tap into a guaranteed failure.
  const blockedMessage = !recorder.supported
    ? t.identify.notSupported
    : recorder.insecure
      ? t.identify.insecureContext
      : '';

  return (
    <main className="flex-1 flex flex-col">

      {/* Recording Header */}
      <div className="bg-navy text-white py-12 px-6 flex flex-col items-center">
        <h1 className="text-3xl font-bold mb-2 text-center">
          {titleBefore}<span className="text-kesri">{t.identify.titleWord}</span>{titleAfter}
        </h1>
        <p className="mb-8 text-sm text-slate-300 text-center max-w-xl">
          {t.identify.subtitle}
        </p>

        <RecordButton
          status={recorder.status}
          elapsedMs={recorder.elapsedMs}
          level={recorder.level}
          disabled={processing || blockedMessage !== ''}
          onPress={handlePress}
          onCancel={handleCancel}
        />

        {blockedMessage ? (
          <p role="alert" className="mt-6 text-sm text-center max-w-md text-amber-200">
            {blockedMessage}
          </p>
        ) : (
          <p className="mt-6 text-xs text-slate-400 text-center max-w-md">
            {t.identify.privacyNote}
          </p>
        )}
      </div>

      {/* Results Area */}
      <div className="max-w-3xl mx-auto w-full p-6 flex-1 space-y-10">

        <div
          ref={resultRegionRef}
          tabIndex={-1}
          role="region"
          aria-label={t.identify.resultRegionAria}
          aria-live="polite"
          aria-busy={processing}
          className="space-y-6 scroll-mt-20 outline-none"
        >
          {processing && (
            <>
              <p className="text-center text-ink-muted">
                {t.identify.processing}
                <span className="block text-sm text-ink-faint mt-1">{t.identify.processingHint}</span>
              </p>
              <IdentifySkeleton />
            </>
          )}

          {error && !processing && (
            <div role="alert" className="text-center py-10 px-4 text-red-600 bg-red-50 rounded-xl border border-red-100 dark:bg-red-950/40 dark:text-red-400 dark:border-red-900">
              {error}
            </div>
          )}

          {result && !processing && !error && (
            <IdentifyResults result={result} onTryAgain={handleTryAgain} />
          )}

          {!result && !processing && !error && (
            <p className="text-center py-10 text-ink-faint">{t.identify.emptyState}</p>
          )}
        </div>

        <IdentifyHistory
          entries={history.entries}
          hydrated={history.hydrated}
          onSelect={handleHistorySelect}
          onRemove={history.remove}
          onClear={history.clear}
        />
      </div>

    </main>
  );
}
