'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { MAX_RECORD_MS, MIN_RECORD_MS } from '@/lib/identify/config';

// Microphone capture for Shabad identification. The clip is uploaded in
// whatever container the browser recorded — Chrome and Firefox produce
// webm/opus, Safari mp4/aac — because the transcription API accepts all of
// them. Decoding and re-encoding in the browser would cost seconds of CPU on a
// phone and buy nothing.

export type RecorderStatus = 'idle' | 'requesting' | 'recording';

// Machine kinds rather than messages: the page owns translation.
export type MicErrorKind = 'denied' | 'unavailable' | 'busy' | 'unsupported' | 'failed';

export type Recording = {
    blob: Blob;
    durationMs: number;
    // Peak amplitude seen while recording, 0..1. The page uses it to catch a
    // silent clip before spending a transcription call on it.
    peakLevel: number;
};

// Below this the clip is silence: a muted mic, a pocket tap, or a phone face
// down on a table. Deliberately low — kirtan heard from across a hall is quiet
// but not this quiet.
const SILENCE_PEAK = 0.02;

// How often the elapsed counter and level meter refresh. Fast enough to look
// live, slow enough not to re-render the page every frame.
const TICK_MS = 100;

function classifyError(error: unknown): MicErrorKind {
    const name = error instanceof DOMException ? error.name : '';
    if (name === 'NotAllowedError' || name === 'SecurityError') return 'denied';
    if (name === 'NotFoundError' || name === 'OverconstrainedError') return 'unavailable';
    if (name === 'NotReadableError' || name === 'AbortError') return 'busy';
    return 'failed';
}

// Ordered by preference. Chrome and Firefox take the first, Safari falls
// through to mp4; the empty string lets the browser choose if it rejects every
// explicit type.
const MIME_CANDIDATES = [
    'audio/webm;codecs=opus',
    'audio/webm',
    'audio/ogg;codecs=opus',
    'audio/mp4',
    '',
];

function pickMimeType(): string {
    for (const type of MIME_CANDIDATES) {
        if (type === '') return '';
        try {
            if (MediaRecorder.isTypeSupported(type)) return type;
        } catch {
            // Older Safari has no isTypeSupported — let the browser decide.
            return '';
        }
    }
    return '';
}

export function useIdentifyRecorder() {
    const [status, setStatus] = useState<RecorderStatus>('idle');
    const [elapsedMs, setElapsedMs] = useState(0);
    const [level, setLevel] = useState(0);
    const [supported, setSupported] = useState(true);
    const [insecure, setInsecure] = useState(false);

    const streamRef = useRef<MediaStream | null>(null);
    const recorderRef = useRef<MediaRecorder | null>(null);
    const contextRef = useRef<AudioContext | null>(null);
    const analyserRef = useRef<AnalyserNode | null>(null);
    const chunksRef = useRef<Blob[]>([]);
    const startedAtRef = useRef(0);
    const peakRef = useRef(0);
    const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const autoStopRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    // Set when stop() is waiting on the recorder's final dataavailable event.
    const settleRef = useRef<((recording: Recording | null) => void) | null>(null);
    // Set when the recording is being thrown away rather than uploaded.
    const cancelledRef = useRef(false);
    const onErrorRef = useRef<((kind: MicErrorKind) => void) | null>(null);

    // Capability check runs after mount: SSR has no navigator, and rendering
    // the button disabled on the server would flash the wrong state.
    useEffect(() => {
        const secure = typeof window !== 'undefined' && window.isSecureContext;
        const hasApi =
            typeof navigator !== 'undefined' &&
            !!navigator.mediaDevices?.getUserMedia &&
            typeof MediaRecorder !== 'undefined';
        // eslint-disable-next-line react-hooks/set-state-in-effect
        if (!secure) setInsecure(true);
        if (!hasApi) setSupported(false);
    }, []);

    const teardown = useCallback(() => {
        if (tickRef.current) { clearInterval(tickRef.current); tickRef.current = null; }
        if (autoStopRef.current) { clearTimeout(autoStopRef.current); autoStopRef.current = null; }
        // Stopping the tracks is what releases the OS recording indicator —
        // leaving them live would keep the browser tab flagged as listening.
        streamRef.current?.getTracks().forEach(track => track.stop());
        streamRef.current = null;
        analyserRef.current = null;
        contextRef.current?.close().catch(() => { /* already closed */ });
        contextRef.current = null;
        recorderRef.current = null;
        setLevel(0);
    }, []);

    useEffect(() => teardown, [teardown]);

    // Called when the recorder ends for a reason the user did not ask for:
    // the mic was unplugged, iOS suspended the tab, the track died.
    const abort = useCallback((kind: MicErrorKind) => {
        const settle = settleRef.current;
        settleRef.current = null;
        teardown();
        setStatus('idle');
        setElapsedMs(0);
        chunksRef.current = [];
        if (settle) settle(null);
        else onErrorRef.current?.(kind);
    }, [teardown]);

    const start = useCallback(async (onError: (kind: MicErrorKind) => void) => {
        onErrorRef.current = onError;
        if (!supported) { onError('unsupported'); return; }
        if (status !== 'idle') return;

        setStatus('requesting');
        setElapsedMs(0);
        chunksRef.current = [];
        peakRef.current = 0;
        cancelledRef.current = false;

        let stream: MediaStream;
        try {
            stream = await navigator.mediaDevices.getUserMedia({
                // Plain hints, not `exact`: browsers that cannot honour them
                // ignore them instead of failing. Voice-call DSP is tuned to
                // isolate one nearby speaker, which is precisely wrong for
                // harmonium, tabla, and a hall full of sangat.
                audio: {
                    echoCancellation: false,
                    noiseSuppression: false,
                    autoGainControl: false,
                },
            });
        } catch (error) {
            setStatus('idle');
            onError(classifyError(error));
            return;
        }

        streamRef.current = stream;

        // The AudioContext is created inside the tap that started recording and
        // resumed immediately — iOS refuses to run one created outside a user
        // gesture, and a suspended context reports silence forever.
        try {
            const context = new AudioContext();
            void context.resume();
            const analyser = context.createAnalyser();
            analyser.fftSize = 1024;
            context.createMediaStreamSource(stream).connect(analyser);
            contextRef.current = context;
            analyserRef.current = analyser;
        } catch {
            // The meter is a nicety; recording works without it. peakLevel then
            // stays 0, and the silence check is simply skipped.
        }

        let recorder: MediaRecorder;
        try {
            const mimeType = pickMimeType();
            recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
        } catch (error) {
            teardown();
            setStatus('idle');
            onError(classifyError(error));
            return;
        }

        recorderRef.current = recorder;
        recorder.ondataavailable = event => {
            if (event.data.size > 0) chunksRef.current.push(event.data);
        };
        recorder.onerror = () => abort('failed');
        recorder.onstop = () => {
            const settle = settleRef.current;
            settleRef.current = null;
            const durationMs = Date.now() - startedAtRef.current;
            const parts = chunksRef.current;
            chunksRef.current = [];
            const peakLevel = peakRef.current;
            teardown();
            setStatus('idle');

            if (!settle) return;
            if (cancelledRef.current || parts.length === 0) { settle(null); return; }
            settle({
                blob: new Blob(parts, { type: recorder.mimeType || 'audio/webm' }),
                durationMs,
                peakLevel,
            });
        };

        // A user can navigate away, lock the phone, or unplug a headset mid-clip.
        stream.getTracks().forEach(track => {
            track.onended = () => {
                if (recorderRef.current?.state === 'recording') abort('failed');
            };
        });

        startedAtRef.current = Date.now();
        recorder.start();
        setStatus('recording');

        const buffer = new Uint8Array(analyserRef.current?.frequencyBinCount ?? 0);
        tickRef.current = setInterval(() => {
            setElapsedMs(Date.now() - startedAtRef.current);
            const analyser = analyserRef.current;
            if (!analyser) return;
            analyser.getByteTimeDomainData(buffer);
            // Peak deviation from the 128 midpoint, normalised to 0..1.
            let peak = 0;
            for (const sample of buffer) {
                const amplitude = Math.abs(sample - 128) / 128;
                if (amplitude > peak) peak = amplitude;
            }
            if (peak > peakRef.current) peakRef.current = peak;
            setLevel(peak);
        }, TICK_MS);

        // Hard stop: an open microphone the user forgot about is both a privacy
        // problem and a bigger upload than the matcher needs.
        autoStopRef.current = setTimeout(() => {
            if (recorderRef.current?.state === 'recording') recorderRef.current.stop();
        }, MAX_RECORD_MS);
    }, [abort, status, supported, teardown]);

    // Resolves with the clip, or null if it was cancelled or nothing recorded.
    const stop = useCallback((): Promise<Recording | null> => {
        const recorder = recorderRef.current;
        if (!recorder || recorder.state === 'inactive') return Promise.resolve(null);
        return new Promise<Recording | null>(resolve => {
            settleRef.current = resolve;
            recorder.stop();
        });
    }, []);

    const cancel = useCallback(() => {
        cancelledRef.current = true;
        const recorder = recorderRef.current;
        if (recorder && recorder.state !== 'inactive') recorder.stop();
        else abort('failed');
    }, [abort]);

    return {
        status,
        elapsedMs,
        level,
        supported,
        insecure,
        start,
        stop,
        cancel,
        isSilent: (recording: Recording) =>
            recording.peakLevel > 0 && recording.peakLevel < SILENCE_PEAK,
        isTooShort: (recording: Recording) => recording.durationMs < MIN_RECORD_MS,
    };
}
