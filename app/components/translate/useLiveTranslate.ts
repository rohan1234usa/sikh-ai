'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import type { SourceHint, TranslationResult } from '@/lib/translate/config';
import { normalizeInput } from '@/lib/translate/history';
import {
    LIVE_FIELDS,
    LIVE_PAUSE_MS,
    LONG_PAUSE_MS,
    liveEligible,
    liveView,
    nextLiveCall,
    parseLiveLines,
    refusalPauseMs,
    type LiveAnswer,
    type LiveLines,
    type LiveView,
} from '@/lib/translate/live';

// The live translator's lines for what is in the text box: asked for at
// each pause in typing (POST /api/translate/live), streamed in as they
// come. The rules are in lib/translate/live.ts.
//
// Calls are kept few. Any change aborts the call in flight and waits for
// the next pause; a text already answered, here or by the Translate button
// (the history), is shown again without one; and the page makes at most
// LIVE_CALLS_PER_MINUTE in any minute, then waits, as it does after a 429.
// Live lines stay in memory only: saving each would fill the history with
// the beginnings of one sentence. What the strip shows is lib/translate/
// live.ts's liveView.

// Answered texts kept for this page, newest last.
const CACHE_SIZE = 50;
// A runaway reply: four lines of a few sentences never come near this.
const MAX_REPLY_CHARS = 4000;

// "Ki haal hai?" and "ki  haal hai? " are the same request, as in the history.
const keyOf = (text: string, hint: SourceHint) => `${hint}\u0000${normalizeInput(text)}`;

const linesOf = (r: TranslationResult): LiveLines =>
    ({ input: r.detectedInput, gurmukhi: r.gurmukhi, roman: r.roman, english: r.english });

const complete = (lines: LiveLines) => LIVE_FIELDS.every(f => lines[f]);
const anything = (lines: LiveLines) => LIVE_FIELDS.some(f => lines[f]);

export function useLiveTranslate({ text, hint, enabled, lookup }: {
    text: string;
    hint: SourceHint;
    enabled: boolean;
    // A full result saved for exactly this request (useTranslateHistory).
    lookup: (input: string, sourceHint: SourceHint) => { result: TranslationResult } | undefined;
}): LiveView {
    // A pause also says when it ends, so it can be cleared then.
    const [answer, setAnswer] = useState<(LiveAnswer & { until?: number }) | null>(null);
    const [cache, setCache] = useState<ReadonlyMap<string, LiveLines>>(() => new Map());
    // When each recent call started, for the per-minute cap.
    const callsRef = useRef<number[]>([]);
    // No calls before this (epoch ms): set by a 429.
    const pausedUntilRef = useRef(0);

    const trimmed = text.trim();
    const eligible = liveEligible(trimmed);
    const key = keyOf(trimmed, hint);
    // The history hands back the same entry until it changes, so these
    // lines keep their identity from one render to the next.
    const saved = enabled && eligible === 'ok' ? lookup(trimmed, hint) : undefined;
    const savedLines = useMemo(() => (saved ? linesOf(saved.result) : undefined), [saved]);
    const known = savedLines ?? cache.get(key);
    const needsCall = enabled && eligible === 'ok' && !known;

    // The lines on screen last, shown dimmed while the next call is due, and
    // forgotten once the box is cleared or Live is off. Kept in state, set
    // while rendering, the way React adjusts state to a changed input, so a
    // remembered answer counts as much as one that just streamed in.
    const current = known ?? (answer?.key === key ? answer.lines : null);
    const [held, setHeld] = useState<LiveLines | null>(null);
    const nextHeld = enabled && eligible === 'ok' ? current ?? held : null;
    if (nextHeld !== held) setHeld(nextHeld);

    // The text a call sends, read when it goes. Edits that keep the key
    // (a capital, a doubled space) leave the call in flight alone.
    const textRef = useRef(trimmed);
    useEffect(() => { textRef.current = trimmed; });

    // A pause is forgotten once it's over, even if the text it was for has
    // gone, so it isn't reported for the next text.
    useEffect(() => {
        if (answer?.status !== 'paused' || answer.until === undefined) return;
        const timer = setTimeout(() => setAnswer(a => (a === answer ? null : a)), Math.max(0, answer.until - Date.now()));
        return () => clearTimeout(timer);
    }, [answer]);

    useEffect(() => {
        if (!needsCall) return;
        const controller = new AbortController();
        let timer: ReturnType<typeof setTimeout> | undefined;
        const live = () => !controller.signal.aborted;

        // Asked again once the pause is over, if the text is still this.
        const pauseUntil = (at: number) => {
            const ms = at - Date.now();
            setAnswer({ key, status: 'paused', lines: null, long: ms > LONG_PAUSE_MS, until: at });
            timer = setTimeout(call, ms);
        };

        const call = async () => {
            const now = Date.now();
            const { recent, at } = nextLiveCall(callsRef.current, pausedUntilRef.current, now);
            callsRef.current = recent;
            if (at > now) {
                pauseUntil(at);
                return;
            }
            recent.push(now);

            let raw = '';
            try {
                const res = await fetch('/api/translate/live', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ text: textRef.current, sourceHint: hint }),
                    signal: controller.signal,
                });
                if (!live()) return;
                if (res.status === 429) {
                    // The allowance's or the firewall's: wait as long as it says.
                    pausedUntilRef.current = Date.now() + refusalPauseMs(res.headers.get('retry-after'));
                    void res.body?.cancel();
                    pauseUntil(pausedUntilRef.current);
                    return;
                }
                if (!res.ok || !res.body) {
                    void res.body?.cancel();
                    setAnswer({ key, status: 'failed', lines: null });
                    return;
                }
                const reader = res.body.getReader();
                const decoder = new TextDecoder();
                for (;;) {
                    const { done, value } = await reader.read();
                    if (done) break;
                    raw += decoder.decode(value, { stream: true });
                    if (raw.length > MAX_REPLY_CHARS) throw new Error('The live reply ran past its cap');
                    if (live()) setAnswer({ key, status: 'streaming', lines: parseLiveLines(raw) });
                }
                if (!live()) return;
                const lines = parseLiveLines(raw, true);
                // Not one line in the shape asked for: nothing to show.
                if (!anything(lines)) {
                    setAnswer({ key, status: 'failed', lines: null });
                    return;
                }
                setAnswer({ key, status: 'done', lines });
                // Kept only when whole, so a reply missing a line is asked
                // again next time rather than shown short for good.
                if (complete(lines)) {
                    setCache(prev => {
                        const next = new Map(prev);
                        next.delete(key);
                        next.set(key, lines);
                        if (next.size > CACHE_SIZE) next.delete(next.keys().next().value!);
                        return next;
                    });
                }
            } catch {
                // An abort is the text changing: the next call replaces this one.
                if (!live()) return;
                controller.abort(); // a runaway reply stops costing
                const lines = parseLiveLines(raw, true);
                setAnswer(anything(lines) ? { key, status: 'cut', lines } : { key, status: raw ? 'cut' : 'failed', lines: null });
            }
        };

        timer = setTimeout(call, LIVE_PAUSE_MS);
        return () => {
            clearTimeout(timer);
            controller.abort();
        };
    }, [needsCall, key, hint]);

    return liveView({ enabled, eligible, key, known, answer, held });
}
