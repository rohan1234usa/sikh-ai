'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { readJson } from '@/lib/readJson';
import { refusalPauseMs } from '@/lib/translate/live';
import { MAX_EXCHANGES, pickEnglishVoice, silentWav, speakErrorCode, type SpeakErrorCode } from '@/lib/translate/talk';
import type { SpeechPlan } from '@/lib/translate/voice';
import { setAudioSession } from './audioSession';

// Reads Talk's translations aloud. Punjabi always comes from
// /api/translate/speak, as an MP3, since few devices have a Punjabi voice
// (and Android may read Punjabi with an English one); English is read by
// the device's own voice, or by the route where the device has none, or
// where its voice doesn't start.
//
// One <audio> element plays everything. iOS plays one only after a play()
// inside a tap, and speaks only once speechSynthesis has spoken inside one,
// so unlock() plays a moment of silence, and says nothing, in each press and
// release of the button until each has worked. For a finger only the
// release is a tap (HTML's user activation), so a press does nothing there.
// Unlike Web Audio, an <audio> element plays with the ringer switched to
// silent. Each line's MP3 is kept, by its language and text, so hearing it
// again costs nothing; one still coming when the reading stops is kept too,
// since it is paid for.

export type SpeakTrouble = { id: string; code: SpeakErrorCode };

// A device voice that hasn't started by now isn't going to: iOS drops speech
// it doesn't allow yet without an event, and a voice can fail to start. The
// route reads the line instead.
const DEVICE_START_MS = 3_000;

type Fetched = { blob: Blob } | { code: SpeakErrorCode };

// Whether the page is inside a tap, click or key press now. A browser that
// can't say is taken to be.
const activated = () => (navigator as Navigator & { userActivation?: { isActive: boolean } }).userActivation?.isActive ?? true;

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
    const unlockedRef = useRef(false);       // the <audio> element has played in a tap
    const voiceUnlockedRef = useRef(false);  // speechSynthesis has started speaking
    // The line wanted now. A fetch that ends after the reading stopped, or
    // another began, is kept but not played.
    const wantedRef = useRef<object | null>(null);
    const watchdogRef = useRef<ReturnType<typeof setTimeout>>(undefined);
    // MP3s by language and text, and fetches still coming, so no line is
    // paid for twice; a page that is left aborts what is still coming.
    const cacheRef = useRef(new Map<string, Blob>());
    const pendingRef = useRef(new Map<string, Promise<Fetched>>());
    const controllersRef = useRef(new Set<AbortController>());
    // After a 429, or a 503 that says when to ask again (read-aloud held
    // back, or the day's characters spent), no calls until then, and the
    // reason why; after the route's 503 without one (switched off, or not set
    // up), none for this page.
    const pauseRef = useRef<{ until: number; code: SpeakErrorCode } | null>(null);
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
        wantedRef.current = null;
        clearTimeout(watchdogRef.current);
        audioRef.current?.pause();
        try { window.speechSynthesis?.cancel(); } catch { /* none here */ }
        setPlaying(null);
    }, []);

    const unlock = useCallback(() => {
        if (!activated()) return; // a finger's press: its release will do
        if (!unlockedRef.current) {
            const element = setSource(new Blob([silentWav()], { type: 'audio/wav' }));
            element.play().then(() => { unlockedRef.current = true; }, () => { /* the next tap tries again */ });
        }
        // The device's English voice says nothing, silently, and counts as
        // unlocked once it is heard to start.
        const synth = window.speechSynthesis;
        if (!voiceUnlockedRef.current && synth) {
            try {
                const hush = new SpeechSynthesisUtterance(' ');
                hush.volume = 0;
                hush.onstart = () => { voiceUnlockedRef.current = true; };
                synth.speak(hush);
            } catch { /* no voices here: English comes from the route */ }
        }
    }, [setSource]);

    const playBlob = useCallback((id: string, blob: Blob) => {
        const element = setSource(blob);
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

    // A line's MP3: kept, already coming, or asked for now.
    const fetchSpeech = useCallback((plan: SpeechPlan): Promise<Fetched> => {
        const key = `${plan.lang}\u0000${plan.text}`;
        const kept = cacheRef.current.get(key);
        if (kept) return Promise.resolve({ blob: kept });
        const coming = pendingRef.current.get(key);
        if (coming) return coming;
        if (unavailableRef.current) return Promise.resolve({ code: 'speak_unavailable' });
        const pause = pauseRef.current;
        if (pause && Date.now() < pause.until) return Promise.resolve({ code: pause.code });

        const controller = new AbortController();
        controllersRef.current.add(controller);
        const request = (async (): Promise<Fetched> => {
            try {
                const res = await fetch('/api/translate/speak', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ text: plan.text, lang: plan.lang }),
                    signal: controller.signal,
                });
                if (!res.ok) {
                    const body = await readJson(res);
                    const code = speakErrorCode(res.status, body);
                    const retryAfter = res.headers.get('retry-after');
                    const routeSaid = (body as { code?: unknown } | null)?.code === 'speak_unavailable';
                    if (res.status === 503 && routeSaid && retryAfter === null) unavailableRef.current = true;
                    else if (res.status === 429 || res.status === 503) pauseRef.current = { until: Date.now() + refusalPauseMs(retryAfter), code };
                    return { code };
                }
                const blob = await res.blob();
                const cache = cacheRef.current;
                cache.set(key, blob);
                if (cache.size > MAX_EXCHANGES) cache.delete(cache.keys().next().value!);
                return { blob };
            } catch {
                return { code: 'speak_failed' };
            } finally {
                controllersRef.current.delete(controller);
                pendingRef.current.delete(key);
            }
        })();
        pendingRef.current.set(key, request);
        return request;
    }, []);

    const fromServer = useCallback(async (id: string, plan: SpeechPlan) => {
        const ticket = {};
        wantedRef.current = ticket;
        setPlaying(id);
        const got = await fetchSpeech(plan);
        if (wantedRef.current !== ticket) return; // stopped, or another began: kept, not played
        wantedRef.current = null;
        if ('blob' in got) playBlob(id, got.blob);
        else {
            settle(id);
            setTrouble({ id, code: got.code });
        }
    }, [fetchSpeech, playBlob, settle]);

    const fromDevice = useCallback((id: string, plan: SpeechPlan): boolean => {
        const synth = typeof window !== 'undefined' ? window.speechSynthesis : undefined;
        const voice = synth ? pickEnglishVoice(voicesRef.current.length ? voicesRef.current : synth.getVoices()) : null;
        if (!synth || !voice) return false;
        const utterance = new SpeechSynthesisUtterance(plan.text);
        utterance.voice = voice;
        utterance.lang = voice.lang;
        utterance.onstart = () => {
            clearTimeout(watchdogRef.current);
            voiceUnlockedRef.current = true;
        };
        utterance.onend = () => {
            clearTimeout(watchdogRef.current);
            settle(id);
        };
        utterance.onerror = event => {
            clearTimeout(watchdogRef.current);
            settle(id);
            // Stopped for the next one: not a failure. Anything else, the
            // route reads it instead.
            if (event.error !== 'interrupted' && event.error !== 'canceled') void fromServer(id, plan);
        };
        synth.cancel();
        setPlaying(id);
        synth.speak(utterance);
        clearTimeout(watchdogRef.current);
        watchdogRef.current = setTimeout(() => {
            // Not started: the route reads it, and the next tap unlocks the
            // device's voice again.
            utterance.onstart = utterance.onend = utterance.onerror = null;
            synth.cancel();
            voiceUnlockedRef.current = false;
            void fromServer(id, plan);
        }, DEVICE_START_MS);
        return true;
    }, [fromServer, settle]);

    const speak = useCallback((id: string, plan: SpeechPlan) => {
        stop();
        setTrouble(null);
        // From the speaker, not the earpiece the microphone left it on.
        setAudioSession('playback');
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

    // Leaving the page stops it, abandons what is still coming, and lets
    // the audio go.
    useEffect(() => () => {
        for (const controller of controllersRef.current) controller.abort();
        clearTimeout(watchdogRef.current);
        audioRef.current?.pause();
        try { window.speechSynthesis?.cancel(); } catch { /* none here */ }
        if (urlRef.current) URL.revokeObjectURL(urlRef.current);
    }, []);

    return { playing, trouble, unlock, speak, stop };
}
