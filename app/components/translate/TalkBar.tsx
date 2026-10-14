'use client';

import Link from 'next/link';
import { StopCircleIcon } from '@heroicons/react/24/outline';
import { useLocalePath, useT } from '@/app/context/LanguageContext';
import type { TalkNote, TalkView } from '@/lib/translate/talk';
import { SPEAKERS, type Speaker } from '@/lib/translate/voice';
import TalkButton from './TalkButton';

// The bottom of the Talk page: who is speaking, the Speak switch and a Stop
// while something is read, the button, a line on what is happening, and
// where clips go. The line isn't a live region: the page announces what
// matters once (TalkScreen), so a screen reader isn't talked over.

// Notes about the microphone itself, shown as errors.
const TROUBLE = new Set<TalkNote>(['denied', 'unavailable', 'busy', 'unsupported', 'insecure', 'failed']);

export default function TalkBar({ view, speaker, onSpeaker, speakOn, onSpeakOn, playing, onStop, hintId, onPress, onRelease, onCancel }: {
    view: TalkView;
    speaker: Speaker;
    onSpeaker: (speaker: Speaker) => void;
    speakOn: boolean;
    onSpeakOn: (on: boolean) => void;
    playing: boolean;
    onStop: () => void;
    hintId: string;
    onPress: () => void;
    onRelease: () => void;
    onCancel: () => void;
}) {
    const t = useT();
    const to = useLocalePath();
    const talk = t.translate.talk;
    const chips: Record<Speaker, string> = { auto: talk.speakerAuto, pa: talk.speakerPunjabi, en: talk.speakerEnglish };
    const { status } = view;
    const line = !status ? ''
        : status.kind === 'note' ? talk.notes[status.note]
        : status.kind === 'paused' ? t.errors[status.code]
        : status.kind === 'translating' ? talk.translating
        : '';
    const isError = status?.kind === 'paused' || (status?.kind === 'note' && TROUBLE.has(status.note));

    return (
        <div className="shrink-0 border-t border-edge bg-surface-raised px-3 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
            <div className="mx-auto max-w-2xl space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                    <div role="group" aria-label={talk.speakerAria} className="flex flex-wrap gap-1.5">
                        {SPEAKERS.map(id => (
                            <button
                                key={id}
                                type="button"
                                onClick={() => onSpeaker(id)}
                                aria-pressed={speaker === id}
                                className={`rounded border px-3 py-1 text-sm transition-colors ${speaker === id
                                    ? 'border-ink bg-ink font-semibold text-surface'
                                    : 'border-edge-strong text-ink hover:bg-edge/60'}`}
                            >
                                {chips[id]}
                            </button>
                        ))}
                    </div>
                    <div className="flex items-center gap-2">
                        {playing && (
                            <button
                                type="button"
                                onClick={onStop}
                                className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-sm font-semibold text-link transition-colors hover:bg-link/10"
                            >
                                <StopCircleIcon className="h-5 w-5" aria-hidden="true" />
                                {talk.stopReading}
                            </button>
                        )}
                        {/* Named by the hint, which holds the visible word. */}
                        <button
                            type="button"
                            role="switch"
                            aria-checked={speakOn}
                            onClick={() => onSpeakOn(!speakOn)}
                            aria-label={talk.speakSwitchHint}
                            title={talk.speakSwitchHint}
                            className="flex items-center gap-2 rounded py-1 pl-1 pr-2 text-xs font-semibold text-ink-muted transition-colors hover:text-ink"
                        >
                            <span
                                aria-hidden
                                className={`relative inline-block h-4 w-7 shrink-0 rounded-full transition-colors ${speakOn ? 'bg-accent-text' : 'bg-ink-faint'}`}
                            >
                                <span className={`absolute top-0.5 size-3 rounded-full bg-white shadow transition-[left] ${speakOn ? 'left-3.5' : 'left-0.5'}`} />
                            </span>
                            {talk.speakSwitch}
                        </button>
                    </div>
                </div>

                <TalkButton view={view} hintId={hintId} onPress={onPress} onRelease={onRelease} onCancel={onCancel} />
                <p id={hintId} className="sr-only">{talk.keyboardHint}</p>

                <p className={`min-h-5 text-sm ${isError ? 'text-red-700 dark:text-red-400' : 'text-ink-muted'}`}>{line}</p>

                <p className="text-[11px] text-ink-muted">
                    {talk.disclaimer}{' '}
                    <Link href={to('/privacy')} className="underline hover:text-link">{t.footer.privacy}</Link>
                    {' · '}
                    <Link href={to('/terms')} className="underline hover:text-link">{t.footer.terms}</Link>
                </p>
            </div>
        </div>
    );
}
