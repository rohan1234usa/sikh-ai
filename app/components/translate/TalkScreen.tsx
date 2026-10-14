'use client';

import { useCallback, useEffect, useId, useReducer, useRef, useState } from 'react';
import { ArrowDownIcon, MicrophoneIcon, PlusIcon } from '@heroicons/react/24/outline';
import IntentLink from '@/app/components/IntentLink';
import { useAnnouncer } from '@/app/components/useAnnouncer';
import { useLanguage } from '@/app/context/LanguageContext';
import { fmt } from '@/lib/i18n/fmt';
import type { Dictionary } from '@/lib/i18n';
import type { Lang } from '@/lib/i18n/config';
import type { TalkCopy } from '@/lib/i18n/talk';
import type { LiveField } from '@/lib/translate/live';
import { EMPTY_TALK, clipCheck, talkReducer, talkView, type Exchange, type TalkNote } from '@/lib/translate/talk';
import { rolesOf, speechReady, type Speaker } from '@/lib/translate/voice';
import TalkBar from './TalkBar';
import TalkExchange from './TalkExchange';
import { useRecorder, type Clip } from './useRecorder';
import { useSpeakSwitch } from './useSpeakSwitch';
import { useSpeaker } from './useSpeaker';
import { useVoiceTranslate } from './useVoiceTranslate';

// Talk (/translate/talk, #37): a conversation between someone speaking
// Punjabi and someone speaking English, with a phone between them. Hold the
// button and speak; let go, and what was heard and its translation come in
// as they're written, and the translation is read aloud. The rules are
// lib/translate/talk.ts's; the three hooks record, send and speak. Nothing
// here is kept: a reload starts a new conversation.

// What a screen reader hears when an exchange ends: what was heard, then
// the translation, each with its label. Punjabi is read from its Gurmukhi
// line where the interface is in Gurmukhi (a reader set up for it), and from
// its romanized line elsewhere, which an English voice can say.
function spoken(talk: TalkCopy, t: Dictionary, lang: Lang, exchange: Exchange): string {
    if (exchange.status === 'failed') return t.errors[exchange.error ?? 'translate_voice_failed'];
    const roles = rolesOf(exchange.lines, exchange.speaker);
    if (!roles) return '';
    const punjabi: readonly LiveField[] = lang === 'pa' ? ['gurmukhi', 'roman'] : ['roman', 'gurmukhi'];
    const text = (fields: readonly LiveField[]) =>
        (fields.includes('english') ? ['english' as const] : punjabi).map(f => exchange.lines[f]).find(Boolean) ?? '';
    // A full stop after each part, unless it ends in one of its own.
    const sentence = (s: string) => (/[.?!।॥]$/.test(s) ? s : `${s}.`);
    return [
        sentence(`${fmt(talk.heard, { lang: talk.langs[roles.from] })}: ${text(roles.heard)}`),
        sentence(`${fmt(talk.translation, { lang: talk.langs[roles.to] })}: ${text(roles.said)}`),
        exchange.status === 'cut' ? talk.cut : '',
    ].filter(Boolean).join(' ');
}

// `copy` is the page's words (lib/i18n/talk), from the server page.
export default function TalkScreen({ copy: talk }: { copy: TalkCopy }) {
    const { lang, t, href: to } = useLanguage();
    const hintId = useId();
    const [state, dispatch] = useReducer(talkReducer, EMPTY_TALK);
    const [speaker, setSpeaker] = useState<Speaker>('auto');
    const [speakOn, setSpeakOn] = useSpeakSwitch();
    const { announce, announcer } = useAnnouncer();
    const sender = useVoiceTranslate(dispatch);
    const speech = useSpeaker();

    // The chip when a clip ends, not when it began: a speaker changed mid-clip
    // is the one meant.
    const speakerRef = useRef(speaker);
    useEffect(() => { speakerRef.current = speaker; });

    const note = useCallback((n: TalkNote) => {
        dispatch({ type: 'note', note: n });
        announce(talk.notes[n]);
    }, [announce, talk]);

    const { send } = sender;
    const onClip = useCallback((clip: Clip, startDelayMs: number) => {
        const check = clipCheck({ durationMs: clip.durationMs, bytes: clip.blob.size, voicedMs: clip.voicedMs }, startDelayMs);
        if (check !== 'ok') {
            const notes = { short: 'tooShort', prompted: 'micReady', long: 'tooLong', silent: 'nothingHeard' } as const;
            note(notes[check]);
            return;
        }
        send(crypto.randomUUID(), clip, speakerRef.current);
        announce(talk.translating);
    }, [announce, note, send, talk]);
    const recorder = useRecorder({ onClip, onTrouble: note });
    const view = talkView({ state, recorder: recorder.status });

    // A refusal's pause is announced once, and ends on its own at its
    // Retry-After.
    const { pause } = state;
    useEffect(() => {
        if (!pause) return;
        announce(t.errors[pause.code]);
        const timer = setTimeout(() => dispatch({ type: 'pauseOver' }), Math.max(0, pause.until - Date.now()));
        return () => clearTimeout(timer);
    }, [pause, announce, t]);

    // Each translation is read aloud once, as soon as it is whole; not while
    // someone is recording, and not one cut short.
    const handled = useRef(new Set<string>());
    const recording = recorder.status === 'recording' || recorder.status === 'starting';
    const { speak } = speech;
    useEffect(() => {
        for (const exchange of state.exchanges) {
            if (handled.current.has(exchange.id)) continue;
            if (exchange.status === 'failed' || exchange.status === 'cut') {
                handled.current.add(exchange.id);
                continue;
            }
            const plan = speechReady(exchange.lines, exchange.speaker, exchange.status === 'done');
            if (!plan) continue;
            handled.current.add(exchange.id);
            if (speakOn && !recording) speak(exchange.id, plan);
        }
    }, [state.exchanges, speakOn, recording, speak]);

    // A screen reader hears each exchange once it ends, whole.
    const announced = useRef(new Set<string>());
    useEffect(() => {
        for (const exchange of state.exchanges) {
            if (exchange.status === 'streaming' || announced.current.has(exchange.id)) continue;
            announced.current.add(exchange.id);
            const words = spoken(talk, t, lang, exchange);
            if (words) announce(words);
        }
    }, [state.exchanges, announce, talk, t, lang]);

    // A hidden page stops reading aloud (the recorder stops itself).
    const { stop } = speech;
    useEffect(() => {
        const onHidden = () => { if (document.hidden) stop(); };
        document.addEventListener('visibilitychange', onHidden);
        return () => document.removeEventListener('visibilitychange', onHidden);
    }, [stop]);

    const onPress = () => {
        if (view.button !== 'hold') return;
        // In the press itself: playback stops, and is unlocked for later
        // where a press counts as a tap (a mouse, a key).
        speech.stop();
        speech.unlock();
        dispatch({ type: 'pressed' });
        recorder.press();
        announce(talk.listening);
    };
    // For a finger, letting go is the tap that lets the page play and speak
    // later.
    const onRelease = () => {
        speech.unlock();
        recorder.release();
    };

    const clear = () => {
        if (state.exchanges.length === 0) return;
        sender.abort();
        speech.stop();
        dispatch({ type: 'cleared' });
    };

    // Stick to the bottom while lines come in, unless the reader scrolled up.
    const scrollRef = useRef<HTMLDivElement>(null);
    const atBottomRef = useRef(true);
    const [showJump, setShowJump] = useState(false);
    useEffect(() => {
        const el = scrollRef.current;
        if (el && atBottomRef.current) el.scrollTop = el.scrollHeight;
    }, [state.exchanges]);
    const onScroll = () => {
        const el = scrollRef.current;
        if (!el) return;
        const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
        atBottomRef.current = atBottom;
        setShowJump(!atBottom);
    };
    const jumpToBottom = () => {
        const el = scrollRef.current;
        if (!el) return;
        el.scrollTop = el.scrollHeight;
        atBottomRef.current = true;
        setShowJump(false);
    };

    return (
        <div className="flex h-[calc(100dvh-4rem)] min-h-0 flex-col">
            <div className="shrink-0 border-b border-edge bg-surface-raised px-4 py-2">
                <div className="mx-auto flex max-w-2xl items-center justify-between gap-3">
                    <h1 className="flex min-w-0 items-center gap-2 font-bold text-ink">
                        <MicrophoneIcon className="h-5 w-5 shrink-0 text-accent-text" aria-hidden="true" />
                        <span className="truncate">{talk.title}</span>
                    </h1>
                    <div className="flex shrink-0 items-center gap-3 text-sm">
                        <IntentLink href={to('/translate')} className="whitespace-nowrap text-ink-muted hover:text-ink hover:underline">
                            {talk.typeInstead}
                        </IntentLink>
                        <button
                            type="button"
                            onClick={clear}
                            // aria-disabled, not disabled: a disabled button would drop focus.
                            aria-disabled={state.exchanges.length === 0 || undefined}
                            className="inline-flex items-center gap-1 whitespace-nowrap rounded-lg px-2 py-1 font-semibold text-link transition-colors hover:bg-link/10 aria-disabled:cursor-default aria-disabled:opacity-40 aria-disabled:hover:bg-transparent"
                        >
                            <PlusIcon className="h-4 w-4" aria-hidden="true" />
                            <span className="hidden sm:inline">{talk.newConversation}</span>
                            <span className="sr-only sm:hidden">{talk.newConversation}</span>
                        </button>
                    </div>
                </div>
            </div>

            <div className="relative min-h-0 flex-1">
                <div ref={scrollRef} onScroll={onScroll} className="h-full overflow-y-auto p-4 md:p-8">
                    <div className="mx-auto w-full max-w-2xl">
                        {state.exchanges.length === 0 ? (
                            <div className="space-y-3 py-6 text-ink-muted">
                                <p className="text-lg text-ink">{talk.intro}</p>
                                <p className="text-sm">{talk.tip}</p>
                            </div>
                        ) : (
                            <ol aria-label={talk.threadAria} className="space-y-8">
                                {state.exchanges.map(exchange => (
                                    <TalkExchange
                                        key={exchange.id}
                                        copy={talk}
                                        exchange={exchange}
                                        playing={speech.playing === exchange.id}
                                        trouble={speech.trouble?.id === exchange.id ? speech.trouble.code : null}
                                        onSpeak={speech.speak}
                                        onStop={speech.stop}
                                    />
                                ))}
                            </ol>
                        )}
                    </div>
                </div>
                {showJump && (
                    <button
                        type="button"
                        onClick={jumpToBottom}
                        className="absolute bottom-4 left-1/2 flex -translate-x-1/2 items-center gap-1 rounded bg-ink px-3 py-2 text-xs font-semibold text-surface transition-opacity hover:opacity-90"
                    >
                        <ArrowDownIcon className="h-3.5 w-3.5" aria-hidden="true" />
                        {talk.latest}
                    </button>
                )}
            </div>

            {announcer}

            <TalkBar
                copy={talk}
                view={view}
                speaker={speaker}
                onSpeaker={setSpeaker}
                speakOn={speakOn}
                onSpeakOn={setSpeakOn}
                playing={speech.playing !== null}
                onStop={speech.stop}
                hintId={hintId}
                onPress={onPress}
                onRelease={onRelease}
                onCancel={recorder.cancel}
            />
        </div>
    );
}
