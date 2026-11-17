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
// where its voice fails or doesn't start.
//
// One <audio> element plays everything. iOS plays one only after a play()
// inside a tap, and speaks only once speechSynthesis has spoken inside one,
// so unlock() plays a moment of silence, and says nothing, in each press and
// release of the button until each has worked. For a finger only the
// release is a tap (HTML's user activation), so a press does nothing there.
// Unlike Web Audio, an <audio> element plays with the ringer switched to
// silent. Each line's MP3 is kept, by its language and text, until a new
// conversation, so hearing it again costs nothing; one still coming when the
// reading stops is kept too, since it is paid for.

// A device voice that hasn't started by now isn't going to: iOS drops speech
// it doesn't allow yet without an event, and a voice can hang. The route
// reads the line instead, and the English lines after it, until the voice is
// heard to start (the next tap's silent line may wake it).
const DEVICE_START_MS = 3_000;

type Fetched = { blob: Blob } | { code: SpeakErrorCode };

// Whether the page is inside a tap, click or key press now. A browser that
// can't say is taken to be.
const activated = () => (navigator as Navigator & { userActivation?: { isActive: boolean } }).userActivation?.isActive ?? true;

export function useSpeaker(): {
    playing: string | null;                                // the exchange being read (or fetched to read)
    trouble: { id: string; code: SpeakErrorCode } | null;  // why the last one couldn't be
    unlock: () => void;
    speak: (id: string, plan: SpeechPlan) => void;
    stop: () => void;
    forget: () => void;                                    // a new conversation
} {
    const [playing, setPlaying] = useState<string | null>(null);
    const [trouble, setTrouble] = useState<{ id: string; code: SpeakErrorCode } | null>(null);
    const audioRef = useRef<HTMLAudioElement | null>(null);
    const urlRef = useRef<string | null>(null);
    const unlockedRef = useRef(false); // the <audio> element has played in a tap
    // The device's English voice: heard to start ('works'), or not started in
    // time ('silent': English goes to the route until it is heard again).
    const deviceRef = useRef<'unknown' | 'works' | 'silent'>('unknown');
    // The device's line being read, and its watchdog.
    const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);
    const watchdogRef = useRef<ReturnType<typeof setTimeout>>(undefined);
    // The line wanted now. A fetch that ends after the reading stopped, or
    // another began, is kept but not played.
    const wantedRef = useRef<object | null>(null);
    // MP3s by language and text, and fetches still coming, so no line is
    // paid for twice. A new conversation is a new generation: what was still
    // coming for the old one isn't kept.
    const cacheRef = useRef(new Map<string, Blob>());
    const pendingRef = useRef(new Map<string, Promise<Fetched>>());
    const generationRef = useRef(0);
    // Aborted when the page is left: whatever is still coming isn't wanted.
    const leaveRef = useRef<AbortController | null>(null);
    // After a 429 or 503 (busy, at a limit, held back, out of characters, or
    // switched off), no calls until its Retry-After, and the reason why.
    const pauseRef = useRef<{ until: number; code: SpeakErrorCode } | null>(null);
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

    const englishVoice = useCallback(() => {
        const synth = typeof window !== 'undefined' ? window.speechSynthesis : undefined;
        return synth ? pickEnglishVoice(voicesRef.current.length ? voicesRef.current : synth.getVoices()) : null;
    }, []);

    // The device's line, let go. Its handlers come off first: a cancelled
    // line's end or error event can arrive after the next line has begun
    // (Chrome sends it later), and must not touch that one. Its watchdog stops.
    const dropUtterance = useCallback(() => {
        clearTimeout(watchdogRef.current);
        const utterance = utteranceRef.current;
        if (utterance) utterance.onstart = utterance.onend = utterance.onerror = null;
        utteranceRef.current = null;
    }, []);

    const stop = useCallback(() => {
        wantedRef.current = null;
        dropUtterance();
        audioRef.current?.pause();
        try { window.speechSynthesis?.cancel(); } catch { /* none here */ }
        setPlaying(null);
    }, [dropUtterance]);

    const forget = useCallback(() => {
        stop();
        generationRef.current++;
        cacheRef.current.clear();
    }, [stop]);

    const unlock = useCallback(() => {
        if (!activated()) return; // a finger's press: its release will do
        if (!unlockedRef.current) {
            const element = setSource(new Blob([silentWav()], { type: 'audio/wav' }));
            element.play().then(() => { unlockedRef.current = true; }, () => { /* the next tap tries again */ });
        }
        // The device's English voice says nothing, silently, and counts as
        // working once it is heard to start: the same voice the lines use, so
        // its start says something about theirs.
        const synth = window.speechSynthesis;
        if (deviceRef.current !== 'works' && synth) {
            try {
                const hush = new SpeechSynthesisUtterance(' ');
                const voice = englishVoice();
                if (voice) hush.voice = voice;
                hush.volume = 0;
                hush.onstart = () => { deviceRef.current = 'works'; };
                synth.speak(hush);
            } catch { /* no voices here: English comes from the route */ }
        }
    }, [setSource, englishVoice]);

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
        const pause = pauseRef.current;
        if (pause && Date.now() < pause.until) return Promise.resolve({ code: pause.code });

        const generation = generationRef.current;
        const request = (async (): Promise<Fetched> => {
            try {
                const res = await fetch('/api/translate/speak', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ text: plan.text, lang: plan.lang }),
                    signal: leaveRef.current?.signal,
                });
                if (!res.ok) {
                    const code = speakErrorCode(res.status, await readJson(res));
                    if (res.status === 429 || res.status === 503) {
                        pauseRef.current = { until: Date.now() + refusalPauseMs(res.headers.get('retry-after')), code };
                    }
                    return { code };
                }
                const blob = await res.blob();
                if (generation === generationRef.current) {
                    const cache = cacheRef.current;
                    cache.set(key, blob);
                    if (cache.size > MAX_EXCHANGES) cache.delete(cache.keys().next().value!);
                }
                return { blob };
            } catch {
                return { code: 'speak_failed' };
            } finally {
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
        const voice = englishVoice();
        if (!synth || !voice || deviceRef.current === 'silent') return false;
        dropUtterance();
        const utterance = new SpeechSynthesisUtterance(plan.text);
        utterance.voice = voice;
        utterance.lang = voice.lang;
        let started = false;
        utterance.onstart = () => {
            started = true;
            clearTimeout(watchdogRef.current);
            deviceRef.current = 'works';
        };
        utterance.onend = () => {
            dropUtterance();
            settle(id);
        };
        utterance.onerror = event => {
            dropUtterance();
            settle(id);
            // Stopped for the next one: not a failure. Anything else, the
            // route reads it instead.
            if (event.error !== 'interrupted' && event.error !== 'canceled') void fromServer(id, plan);
        };
        utteranceRef.current = utterance;
        synth.cancel();
        setPlaying(id);
        synth.speak(utterance);
        watchdogRef.current = setTimeout(() => {
            if (started || utteranceRef.current !== utterance) return;
            // Not started: the route reads this line, and the English ones
            // after it, until the voice is heard to start again.
            dropUtterance();
            synth.cancel();
            deviceRef.current = 'silent';
            void fromServer(id, plan);
        }, DEVICE_START_MS);
        return true;
    }, [dropUtterance, englishVoice, fromServer, settle]);

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

    // Leaving the page abandons what is still coming, stops reading, and
    // lets the audio go.
    useEffect(() => {
        const leave = new AbortController();
        leaveRef.current = leave;
        return () => leave.abort();
    }, []);
    useEffect(() => () => {
        dropUtterance();
        audioRef.current?.pause();
        try { window.speechSynthesis?.cancel(); } catch { /* none here */ }
        if (urlRef.current) URL.revokeObjectURL(urlRef.current);
    }, [dropUtterance]);

    return { playing, trouble, unlock, speak, stop, forget };
}
