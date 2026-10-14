'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { refusalPauseMs } from '@/lib/translate/live';
import { MAX_EXCHANGES, pickEnglishVoice, silentWav, speakErrorCode, type SpeakErrorCode } from '@/lib/translate/talk';
import type { SpeechPlan } from '@/lib/translate/voice';
import { setAudioSession } from './audioSession';

// Reads Talk's translations aloud. Punjabi always comes from
// /api/translate/speak, as an MP3, since few devices have a Punjabi voice
// (and Android may read Punjabi with an English one); English is read by
// the device's own voice, or by the route where the device has none.
//
// One <audio> element plays everything. iOS plays one only after a play()
// inside a tap, so unlock() plays a moment of silence in each press of the
// button; and unlike Web Audio, an <audio> element plays with the ringer
// switched to silent. Each exchange's MP3 is kept for a replay, so hearing it
// again costs nothing.

export type SpeakTrouble = { id: string; code: SpeakErrorCode };

export function useSpeaker(): {
    playing: string | null;        // the exchange being read (or fetched to read)
    trouble: SpeakTrouble | null;  // why the last one couldn't be
    unlock: () => void;
    speak: (id: string, plan: SpeechPlan) => void;
    stop: () => void;
} {
    const [playing, setPlaying] = useState<string | null>(null);
    const [trouble, setTrouble] = useState<SpeakTrouble | null>(null);
    const audioRef = useRef<HTMLAudioElement | null>(null);
    const urlRef = useRef<string | null>(null);
    const unlockedRef = useRef(false);
    const requestRef = useRef<AbortController | null>(null);
    const cacheRef = useRef(new Map<string, Blob>());
    // After a 429, no calls until its Retry-After; after a 503 (switched off,
    // not set up, or the day's characters spent), none for this page.
    const pausedUntilRef = useRef(0);
    const unavailableRef = useRef(false);
    const voicesRef = useRef<SpeechSynthesisVoice[]>([]);

    const audio = useCallback(() => {
        audioRef.current ??= new Audio();
        return audioRef.current;
    }, []);

    const setSource = useCallback((blob: Blob) => {
        const element = audio();
        if (urlRef.current) URL.revokeObjectURL(urlRef.current);
        urlRef.current = URL.createObjectURL(blob);
        element.src = urlRef.current;
        return element;
    }, [audio]);

    const settle = useCallback((id: string) => setPlaying(current => (current === id ? null : current)), []);

    const stop = useCallback(() => {
        requestRef.current?.abort();
        requestRef.current = null;
        audioRef.current?.pause();
        try { window.speechSynthesis?.cancel(); } catch { /* none here */ }
        setPlaying(null);
    }, []);

    const unlock = useCallback(() => {
        if (!unlockedRef.current) {
            const element = setSource(new Blob([silentWav()], { type: 'audio/wav' }));
            element.play().then(() => { unlockedRef.current = true; }, () => { /* the next press tries again */ });
        }
    }, [setSource]);

    const playBlob = useCallback((id: string, blob: Blob) => {
        const element = setSource(blob);
        setAudioSession('playback');
        element.onended = () => settle(id);
        element.onerror = () => { settle(id); setTrouble({ id, code: 'speak_failed' }); };
        setPlaying(id);
        element.play().catch((error: unknown) => {
            // Paused for the next one: not a failure.
            if ((error as { name?: string })?.name === 'AbortError') return;
            settle(id);
            setTrouble({ id, code: 'speak_failed' });
        });
    }, [setSource, settle]);

    const fromServer = useCallback(async (id: string, plan: SpeechPlan) => {
        const key = `${id}\u0000${plan.lang}`;
        const kept = cacheRef.current.get(key);
        if (kept) {
            playBlob(id, kept);
            return;
        }
        if (unavailableRef.current || Date.now() < pausedUntilRef.current) {
            setTrouble({ id, code: unavailableRef.current ? 'speak_unavailable' : 'speak_busy' });
            return;
        }
        const controller = new AbortController();
        requestRef.current = controller;
        setPlaying(id);
        try {
            const res = await fetch('/api/translate/speak', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ text: plan.text, lang: plan.lang }),
                signal: controller.signal,
            });
            if (!res.ok) {
                const body = res.headers.get('content-type')?.includes('json') ? await res.json().catch(() => null) : null;
                const code = speakErrorCode(res.status, body);
                if (res.status === 429) pausedUntilRef.current = Date.now() + refusalPauseMs(res.headers.get('retry-after'));
                if (code === 'speak_unavailable') unavailableRef.current = true;
                settle(id);
                setTrouble({ id, code });
                return;
            }
            const blob = await res.blob();
            const cache = cacheRef.current;
            cache.set(key, blob);
            if (cache.size > MAX_EXCHANGES) cache.delete(cache.keys().next().value!);
            if (requestRef.current !== controller) return; // stopped, or another began
            requestRef.current = null;
            playBlob(id, blob);
        } catch {
            if (controller.signal.aborted) return;
            settle(id);
            setTrouble({ id, code: 'speak_failed' });
        }
    }, [playBlob, settle]);

    const fromDevice = useCallback((id: string, plan: SpeechPlan): boolean => {
        const synth = typeof window !== 'undefined' ? window.speechSynthesis : undefined;
        const voice = synth ? pickEnglishVoice(voicesRef.current.length ? voicesRef.current : synth.getVoices()) : null;
        if (!synth || !voice) return false;
        const utterance = new SpeechSynthesisUtterance(plan.text);
        utterance.voice = voice;
        utterance.lang = voice.lang;
        utterance.onend = () => settle(id);
        utterance.onerror = event => {
            settle(id);
            // Stopped for the next one: not a failure. Anything else, the
            // route reads it instead.
            if (event.error !== 'interrupted' && event.error !== 'canceled') void fromServer(id, plan);
        };
        synth.cancel();
        setPlaying(id);
        synth.speak(utterance);
        return true;
    }, [fromServer, settle]);

    const speak = useCallback((id: string, plan: SpeechPlan) => {
        stop();
        setTrouble(null);
        if (plan.lang === 'en' && fromDevice(id, plan)) return;
        void fromServer(id, plan);
    }, [fromDevice, fromServer, stop]);

    // The device's voices load late in some browsers.
    useEffect(() => {
        const synth = typeof window !== 'undefined' ? window.speechSynthesis : undefined;
        if (!synth) return;
        const read = () => { voicesRef.current = synth.getVoices(); };
        read();
        synth.addEventListener?.('voiceschanged', read);
        return () => synth.removeEventListener?.('voiceschanged', read);
    }, []);

    // Leaving the page stops it and lets the audio go.
    useEffect(() => () => {
        requestRef.current?.abort();
        audioRef.current?.pause();
        try { window.speechSynthesis?.cancel(); } catch { /* none here */ }
        if (urlRef.current) URL.revokeObjectURL(urlRef.current);
    }, []);

    return { playing, trouble, unlock, speak, stop };
}
