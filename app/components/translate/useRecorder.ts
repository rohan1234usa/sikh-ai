'use client';

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { VOICE_RMS, micTrouble, pickRecordingMime, rms, type MicTrouble, type RecorderStatus } from '@/lib/translate/talk';
import { MAX_CLIP_MS } from '@/lib/translate/voice';
import { setAudioSession } from './audioSession';

// Talk's microphone: it records while the button is held, and only then.
// The microphone is asked for on each press and let go on each release, so
// the browser's "in use" mark is never on between clips. A clip is recorded
// in whatever the browser records (WebM or Ogg Opus, or AAC in MP4 on
// Safari), all of which Gemini hears, so nothing is re-encoded here. The
// rules (which type, what an error means, whether a clip is worth sending)
// are lib/translate/talk.ts's.
//
// While it records, it also measures how loud each tenth of a second is, so
// a clip with no speech in it is never sent (Gemini writes words down even
// from silence). Its AudioContext is made, and resumed, inside the press:
// iOS runs one only from a tap. If it isn't running, the clip says nothing
// about its loudness, and is sent as it is.

export type Clip = {
    blob: Blob;
    mimeType: string;
    durationMs: number;
    voicedMs?: number; // how much of it was at speech's loudness; unknown if not measured
};

const TICK_MS = 100;

const noSubscription = () => () => {};
// Whether this browser can record here: https (localhost counts), and the
// two APIs. Read after hydration; the server draws the button as usable.
function readSupport(): 'insecure' | 'unsupported' | 'ready' {
    if (!window.isSecureContext) return 'insecure';
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') return 'unsupported';
    return 'ready';
}

export function useRecorder({ onClip, onTrouble }: {
    // A finished clip, and how long the press took to start recording.
    onClip: (clip: Clip, startDelayMs: number) => void;
    onTrouble: (trouble: MicTrouble | 'interrupted') => void;
}): { status: RecorderStatus; press: () => void; release: () => void; cancel: () => void } {
    const support = useSyncExternalStore(noSubscription, readSupport, () => 'unknown' as const);
    const [phase, setPhase] = useState<'idle' | 'starting' | 'recording'>('idle');
    const phaseRef = useRef(phase);
    const enter = useCallback((next: typeof phase) => { phaseRef.current = next; setPhase(next); }, []);

    const handlers = useRef({ onClip, onTrouble });
    useEffect(() => { handlers.current = { onClip, onTrouble }; });

    // One press at a time: a press's late answers are ignored once another
    // has begun, or the page has gone.
    const pressRef = useRef(0);
    const streamRef = useRef<MediaStream | null>(null);
    const recorderRef = useRef<MediaRecorder | null>(null);
    const timerRef = useRef<ReturnType<typeof setTimeout>>(undefined);
    const tickRef = useRef<ReturnType<typeof setInterval>>(undefined);
    const contextRef = useRef<AudioContext | null>(null);
    const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
    const releasedRef = useRef(false);  // let go before recording began
    const discardRef = useRef(false);   // cancelled: nothing to send

    const teardown = useCallback(() => {
        clearTimeout(timerRef.current);
        clearInterval(tickRef.current);
        sourceRef.current?.disconnect();
        sourceRef.current = null;
        // Stopping the tracks is what turns off the browser's microphone mark.
        streamRef.current?.getTracks().forEach(track => track.stop());
        streamRef.current = null;
        recorderRef.current = null;
        enter('idle');
    }, [enter]);

    const release = useCallback(() => {
        const recorder = recorderRef.current;
        if (recorder && recorder.state !== 'inactive') {
            clearTimeout(timerRef.current);
            recorder.stop();
        } else if (phaseRef.current === 'starting') {
            releasedRef.current = true;
        }
    }, []);

    const cancel = useCallback(() => {
        discardRef.current = true;
        const recorder = recorderRef.current;
        if (recorder && recorder.state !== 'inactive') recorder.stop();
        else if (phaseRef.current !== 'starting') teardown();
    }, [teardown]);

    const press = useCallback(async () => {
        if (phaseRef.current !== 'idle' || readSupport() !== 'ready') return;
        const id = ++pressRef.current;
        releasedRef.current = false;
        discardRef.current = false;
        const pressedAt = performance.now();
        enter('starting');
        setAudioSession('auto');
        // In the tap itself, or iOS never lets it run.
        try {
            contextRef.current ??= new AudioContext();
            void contextRef.current.resume();
        } catch { /* no Web Audio here: clips go unmeasured */ }

        let stream: MediaStream;
        try {
            // Hints, not demands: a browser that can't honour one ignores it.
            stream = await navigator.mediaDevices.getUserMedia({
                audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true, autoGainControl: true },
            });
        } catch (error) {
            if (id !== pressRef.current) return;
            enter('idle');
            if (!discardRef.current) handlers.current.onTrouble(micTrouble(error));
            return;
        }
        const startDelayMs = performance.now() - pressedAt;
        if (id !== pressRef.current || discardRef.current || releasedRef.current) {
            stream.getTracks().forEach(track => track.stop());
            if (id !== pressRef.current) return;
            enter('idle');
            // Let go while the browser asked about the microphone, or before it
            // was ready: a clip of nothing, which the page explains.
            if (!discardRef.current) handlers.current.onClip({ blob: new Blob([]), mimeType: '', durationMs: 0 }, startDelayMs);
            return;
        }
        streamRef.current = stream;

        const mimeType = pickRecordingMime(typeof MediaRecorder.isTypeSupported === 'function' ? t => MediaRecorder.isTypeSupported(t) : undefined);
        let recorder: MediaRecorder;
        try {
            // Speech needs little: 32 kbit/s keeps a 15 s clip near 60 KB.
            recorder = new MediaRecorder(stream, { ...(mimeType ? { mimeType } : {}), audioBitsPerSecond: 32_000 });
        } catch {
            try {
                recorder = new MediaRecorder(stream);
            } catch (error) {
                teardown();
                handlers.current.onTrouble(micTrouble(error));
                return;
            }
        }
        recorderRef.current = recorder;

        // Loudness, a tenth of a second at a time.
        let analyser: AnalyserNode | null = null;
        const context = contextRef.current;
        try {
            if (context) {
                sourceRef.current = context.createMediaStreamSource(stream);
                analyser = context.createAnalyser();
                analyser.fftSize = 2048;
                sourceRef.current.connect(analyser);
            }
        } catch { analyser = null; }
        const samples = new Float32Array(analyser?.fftSize ?? 0);
        let voicedMs = 0;
        let measured = false;

        const chunks: Blob[] = [];
        let startedAt = 0;
        recorder.ondataavailable = event => { if (event.data.size > 0) chunks.push(event.data); };
        recorder.onstart = () => {
            if (recorderRef.current !== recorder) return;
            startedAt = performance.now();
            enter('recording');
            if (analyser && context) {
                tickRef.current = setInterval(() => {
                    if (context.state !== 'running') return;
                    measured = true;
                    analyser.getFloatTimeDomainData(samples);
                    if (rms(samples) >= VOICE_RMS) voicedMs += TICK_MS;
                }, TICK_MS);
            }
            // A microphone left on by mistake stops on its own.
            timerRef.current = setTimeout(() => { if (recorder.state !== 'inactive') recorder.stop(); }, MAX_CLIP_MS);
        };
        recorder.onstop = () => {
            if (recorderRef.current !== recorder) return;
            const durationMs = startedAt ? performance.now() - startedAt : 0;
            const blob = new Blob(chunks, { type: recorder.mimeType || mimeType || 'audio/webm' });
            const discard = discardRef.current;
            teardown();
            if (!discard) handlers.current.onClip({ blob, mimeType: blob.type, durationMs, voicedMs: measured ? voicedMs : undefined }, startDelayMs);
        };
        recorder.onerror = () => {
            if (recorderRef.current !== recorder) return;
            discardRef.current = true;
            if (recorder.state !== 'inactive') recorder.stop();
            teardown();
            handlers.current.onTrouble('failed');
        };
        // A headset unplugged, or the system taking the microphone away.
        for (const track of stream.getAudioTracks()) {
            track.onended = () => {
                if (recorderRef.current !== recorder) return;
                discardRef.current = true;
                if (recorder.state !== 'inactive') recorder.stop();
                handlers.current.onTrouble('failed');
            };
        }
        try {
            recorder.start();
        } catch (error) {
            teardown();
            handlers.current.onTrouble(micTrouble(error));
        }
    }, [enter, teardown]);

    // A hidden page stops listening: the phone was locked, or the tab left.
    useEffect(() => {
        const onHidden = () => {
            if (!document.hidden || phaseRef.current === 'idle') return;
            cancel();
            handlers.current.onTrouble('interrupted');
        };
        document.addEventListener('visibilitychange', onHidden);
        return () => document.removeEventListener('visibilitychange', onHidden);
    }, [cancel]);

    // Leaving the page lets go of the microphone at once.
    useEffect(() => () => {
        pressRef.current++;
        discardRef.current = true;
        const recorder = recorderRef.current;
        recorderRef.current = null;
        if (recorder && recorder.state !== 'inactive') recorder.stop();
        clearTimeout(timerRef.current);
        clearInterval(tickRef.current);
        streamRef.current?.getTracks().forEach(track => track.stop());
        streamRef.current = null;
        void contextRef.current?.close().catch(() => { /* already closed */ });
        contextRef.current = null;
    }, []);

    const pressNow = useCallback(() => { void press(); }, [press]);
    const status: RecorderStatus = support === 'unknown' ? 'unknown' : support !== 'ready' ? support : phase;
    return { status, press: pressNow, release, cancel };
}
