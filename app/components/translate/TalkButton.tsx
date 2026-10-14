'use client';

import { useRef } from 'react';
import { MicrophoneIcon } from '@heroicons/react/24/solid';
import { useT } from '@/app/context/LanguageContext';
import { PRIMARY_FILL } from '@/app/components/buttons';
import type { TalkView } from '@/lib/translate/talk';

// Talk's button: hold it to record, let go to send. Pointer capture keeps the
// press when a thumb drifts off the button, so letting go anywhere sends;
// a long press shows no menu and selects nothing. From a keyboard, Space or
// Enter starts, the same again stops, and Escape throws the clip away.
// aria-disabled, not disabled, while it can't record, so focus stays.

export default function TalkButton({ view, hintId, onPress, onRelease, onCancel }: {
    view: TalkView;
    hintId: string;
    onPress: () => void;
    onRelease: () => void;
    onCancel: () => void;
}) {
    const t = useT();
    const talk = t.translate.talk;
    // A recording started from the keyboard ends from the keyboard (or by
    // leaving the button), not when a pointer lets go.
    const byKeyboard = useRef(false);
    const active = view.button === 'listening' || view.button === 'starting';
    const blocked = view.button === 'paused' || view.button === 'unavailable';
    const label = {
        hold: talk.hold,
        starting: talk.starting,
        listening: talk.listening,
        paused: talk.paused,
        unavailable: talk.unavailable,
    }[view.button];
    const releasePointer = () => { if (!byKeyboard.current) onRelease(); };

    return (
        <button
            type="button"
            aria-pressed={active}
            aria-disabled={blocked || undefined}
            aria-describedby={hintId}
            onPointerDown={e => {
                if (e.button !== 0 || blocked) return;
                e.preventDefault();
                e.currentTarget.setPointerCapture(e.pointerId);
                byKeyboard.current = false;
                onPress();
            }}
            onPointerUp={releasePointer}
            onPointerCancel={releasePointer}
            onLostPointerCapture={releasePointer}
            onContextMenu={e => e.preventDefault()}
            onKeyDown={e => {
                if (e.key === 'Escape') {
                    if (active) { e.preventDefault(); onCancel(); }
                    return;
                }
                if (e.key !== ' ' && e.key !== 'Enter') return;
                e.preventDefault();
                if (e.repeat || blocked) return;
                if (active) onRelease();
                else { byKeyboard.current = true; onPress(); }
            }}
            onBlur={() => { if (byKeyboard.current && active) onRelease(); }}
            className={`flex min-h-16 w-full touch-none select-none items-center justify-center gap-3 rounded-lg px-5 text-lg font-bold transition-colors [-webkit-touch-callout:none] [-webkit-user-select:none] aria-disabled:cursor-not-allowed aria-disabled:opacity-60 ${active
                ? 'bg-accent-text text-surface'
                : PRIMARY_FILL}`}
        >
            {view.button === 'listening'
                ? <span aria-hidden="true" className="size-3 rounded-full bg-surface motion-safe:animate-pulse" />
                : <MicrophoneIcon className="h-6 w-6" aria-hidden="true" />}
            {label}
        </button>
    );
}
