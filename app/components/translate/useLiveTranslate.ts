'use client';

import { useEffect, useRef, useState } from 'react';
import type { SourceHint, TranslationResult } from '@/lib/translate/config';
import { normalizeInput } from '@/lib/translate/history';
import {
    LIVE_CALLS_PER_MINUTE,
    LIVE_PAUSE_AFTER_REFUSAL_MS,
    LIVE_PAUSE_MS,
    LIVE_FIELDS,
    liveEligible,
    parseLiveLines,
    type LiveLines,
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
// the beginnings of one sentence.

export type LiveStatus =
    | 'off'        // the Live switch is off
    | 'short'      // too little text yet (or none)
    | 'long'       // past MAX_LIVE_CHARS: the Translate button's job
    | 'waiting'    // a call is due at the next pause, or on its way
    | 'streaming'
    | 'done'
    | 'cut'        // the reply stopped early: what came is kept
    | 'paused'     // the per-minute cap, or a 429, until it passes
    | 'failed';

export type LiveView = {
    status: LiveStatus;
    // For the text in the box, or while 'waiting', the last lines shown
    // (`stale`), so the strip doesn't flicker empty between pauses.
    lines: LiveLines | null;
    stale: boolean;
};

// Answered texts kept for this page, newest last.
const CACHE_SIZE = 50;
const MINUTE_MS = 60_000;
// A runaway reply: four lines of a few sentences never come near this.
const MAX_REPLY_CHARS = 4000;

type Answer = { key: string; status: 'streaming' | 'done' | 'cut' | 'paused' | 'failed'; lines: LiveLines | null };

// "Ki haal hai?" and "ki  haal hai? " are the same request, as in the history.
const keyOf = (text: string, hint: SourceHint) => `${hint}\u0000${normalizeInput(text)}`;

const linesOf = (r: TranslationResult): LiveLines =>
    ({ input: r.detectedInput, gurmukhi: r.gurmukhi, roman: r.roman, english: r.english });

const complete = (lines: LiveLines) => LIVE_FIELDS.every(f => lines[f]);
const anything = (lines: LiveLines) => LIVE_FIELDS.some(f => lines[f]);

// Seconds from a 429's Retry-After, else a minute.
function pauseFor(res: Response): number {
    const seconds = Number(res.headers.get('retry-after'));
    return Number.isFinite(seconds) && seconds > 0 ? seconds * 1000 : LIVE_PAUSE_AFTER_REFUSAL_MS;
}

export function useLiveTranslate({ text, hint, enabled, lookup }: {
    text: string;
    hint: SourceHint;
    enabled: boolean;
    // A full result saved for exactly this request (useTranslateHistory).
    lookup: (input: string, sourceHint: SourceHint) => { result: TranslationResult } | undefined;
}): LiveView {
    const [answer, setAnswer] = useState<Answer | null>(null);
    const [cache, setCache] = useState<ReadonlyMap<string, LiveLines>>(() => new Map());
    // When each recent call started, for the per-minute cap.
    const callsRef = useRef<number[]>([]);
    // No calls before this (epoch ms): set by a 429.
    const pausedUntilRef = useRef(0);

    const trimmed = text.trim();
    const eligible = liveEligible(trimmed);
    const key = keyOf(trimmed, hint);
    const saved = enabled && eligible === 'ok' ? lookup(trimmed, hint) : undefined;
    const known = saved ? linesOf(saved.result) : cache.get(key);
    const needsCall = enabled && eligible === 'ok' && !known;

    useEffect(() => {
        if (!needsCall) return;
        const controller = new AbortController();
        let timer: ReturnType<typeof setTimeout> | undefined;
        const live = () => !controller.signal.aborted;

        const call = async () => {
            const now = Date.now();
            const recent = callsRef.current.filter(t => now - t < MINUTE_MS);
            callsRef.current = recent;
            const freeAt = Math.max(
                pausedUntilRef.current,
                recent.length >= LIVE_CALLS_PER_MINUTE ? recent[0] + MINUTE_MS : 0,
            );
            if (freeAt > now) {
                // Asked again once the pause is over, if the text is still this.
                setAnswer({ key, status: 'paused', lines: null });
                timer = setTimeout(call, freeAt - now);
                return;
            }
            recent.push(now);

            let raw = '';
            try {
                const res = await fetch('/api/translate/live', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ text: trimmed, sourceHint: hint }),
                    signal: controller.signal,
                });
                if (!live()) return;
                if (res.status === 429) {
                    // The allowance's or the firewall's: wait as long as it says.
                    pausedUntilRef.current = Date.now() + pauseFor(res);
                    void res.body?.cancel();
                    setAnswer({ key, status: 'paused', lines: null });
                    timer = setTimeout(call, pausedUntilRef.current - Date.now());
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
    }, [needsCall, key, trimmed, hint]);

    if (!enabled) return { status: 'off', lines: null, stale: false };
    if (eligible !== 'ok') return { status: eligible, lines: null, stale: false };
    if (known) return { status: 'done', lines: known, stale: false };
    if (answer?.key === key) return { status: answer.status, lines: answer.lines, stale: false };
    // Due at the next pause: the last lines stay up, marked as for older text.
    const last = answer?.lines ?? null;
    return { status: 'waiting', lines: last, stale: last !== null };
}
