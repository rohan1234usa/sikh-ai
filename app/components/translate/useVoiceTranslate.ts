'use client';

import { useCallback, useEffect, useRef, type Dispatch } from 'react';
import { parseLiveLines, refusalPauseMs } from '@/lib/translate/live';
import { bytesToBase64, voiceErrorCode, type TalkEvent } from '@/lib/translate/talk';
import { baseMime, type Speaker } from '@/lib/translate/voice';
import type { Clip } from './useRecorder';

// Sends Talk's clips to /api/translate/voice and streams each reply's lines
// into the conversation (lib/translate/talk.ts's reducer, through
// `dispatch`). A reply runs to its end even when the other person starts
// talking before it has, since it's their translation; leaving the page, or
// starting a new conversation, abandons whatever is in flight, which stops it
// costing (the route answers 499, or its stream's cancel() stops the
// generation). Every event names its exchange, so a late piece of an
// abandoned reply changes nothing.

// A runaway reply: four lines of a fifteen-second clip never come near this.
const MAX_REPLY_CHARS = 4000;

async function readJson(res: Response): Promise<unknown> {
    if (!res.headers.get('content-type')?.includes('json')) {
        void res.body?.cancel();
        return null;
    }
    return res.json().catch(() => null);
}

export function useVoiceTranslate(dispatch: Dispatch<TalkEvent>): {
    send: (id: string, clip: Clip, speaker: Speaker) => void;
    abort: () => void;
} {
    const inFlight = useRef(new Set<AbortController>());

    const abort = useCallback(() => {
        for (const controller of inFlight.current) controller.abort();
        inFlight.current.clear();
    }, []);
    useEffect(() => abort, [abort]);

    const send = useCallback((id: string, clip: Clip, speaker: Speaker) => {
        const controller = new AbortController();
        inFlight.current.add(controller);
        dispatch({ type: 'sent', id, speaker });

        void (async () => {
            let raw = '';
            try {
                const audio = bytesToBase64(new Uint8Array(await clip.blob.arrayBuffer()));
                const res = await fetch('/api/translate/voice', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ audio, mimeType: baseMime(clip.mimeType) || 'audio/webm', speaker }),
                    signal: controller.signal,
                });
                if (res.status === 429) {
                    // The allowance's or the firewall's: wait as long as it says.
                    const until = Date.now() + refusalPauseMs(res.headers.get('retry-after'));
                    dispatch({ type: 'refused', id, until, code: voiceErrorCode(429, await readJson(res)) });
                    return;
                }
                if (!res.ok || !res.body) {
                    dispatch({ type: 'failed', id, code: voiceErrorCode(res.status, await readJson(res)) });
                    return;
                }
                const reader = res.body.getReader();
                const decoder = new TextDecoder();
                for (;;) {
                    const { done, value } = await reader.read();
                    if (done) break;
                    raw += decoder.decode(value, { stream: true });
                    if (raw.length > MAX_REPLY_CHARS) throw new Error('The voice reply ran past its cap');
                    dispatch({ type: 'lines', id, lines: parseLiveLines(raw) });
                }
                raw += decoder.decode();
                dispatch({ type: 'settled', id, lines: parseLiveLines(raw, true), how: 'whole' });
            } catch {
                // Abandoned (the page left, or a new conversation began): its
                // card is already gone. Otherwise cut off, or a runaway reply
                // stopped here: what came is kept.
                if (controller.signal.aborted) return;
                controller.abort();
                dispatch({ type: 'settled', id, lines: parseLiveLines(raw, true), how: 'cut' });
            } finally {
                inFlight.current.delete(controller);
            }
        })();
    }, [dispatch]);

    return { send, abort };
}
