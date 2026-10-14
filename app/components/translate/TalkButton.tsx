'use client';

import { useRef, type PointerEvent } from 'react';
import { MicrophoneIcon } from '@heroicons/react/24/solid';
import { PRIMARY_FILL } from '@/app/components/buttons';
import type { TalkCopy } from '@/lib/i18n/talk';
import { pointerRelease, type TalkView } from '@/lib/translate/talk';

// Talk's button: hold it to record, let go to send. Pointer capture keeps the
// press when a thumb drifts off the button, so letting go anywhere sends;
// a long press shows no menu and selects nothing. From a keyboard, Space or
// Enter starts, the same again stops, and Escape throws the clip away. A
// screen reader's activation (NVDA or JAWS in browse mode, TalkBack's double
// tap) does what Space does: in Firefox it is a bare click, and in Chrome and
// Edge a pointerdown and pointerup at once before the click, which
// pointerRelease (lib/translate/talk.ts) tells from a hand's.
// aria-disabled, not disabled, while it can't record, so focus stays.

// A click this soon after the button's own press, release or key is that
// gesture's echo, already answered. A finger's or a pen's click always is,
// however late it comes.
const ECHO_MS = 500;

export default function TalkButton({ copy: talk, view, hintId, onPress, onRelease, onCancel }: {
    copy: TalkCopy;
    view: TalkView;
    hintId: string;
    onPress: () => void;
    onRelease: () => void;
    onCancel: () => void;
}) {
    // A recording started from a keyboard or a screen reader ends the same
    // way (or by leaving the button), not when a pointer lets go.
    const toggled = useRef(false);
    const handledAt = useRef(-Infinity);
    const handled = () => { handledAt.current = performance.now(); };
    // The pointer press under way: when it began, and whether the button was
    // already recording.
    const press = useRef<{ at: number; wasActive: boolean } | null>(null);
    const active = view.button === 'listening' || view.button === 'starting';
    const blocked = view.button === 'paused' || view.button === 'unavailable';
    const releasePointer = (e: PointerEvent<HTMLButtonElement>) => {
        handled();
        const what = pointerRelease(press.current, e, toggled.current);
        press.current = null;
        if (what === 'toggleOn') toggled.current = true;
        else if (what === 'stop') onRelease();
    };
    const toggle = () => {
        if (active) onRelease();
        else { toggled.current = true; onPress(); }
    };

    return (
        <button
            type="button"
            aria-pressed={active}
            aria-disabled={blocked || undefined}
            aria-describedby={hintId}
            onPointerDown={e => {
                if (e.button !== 0 || blocked) return;
                handled();
                e.preventDefault();
                // Letting go off the button still ends the press; without
                // capture, letting go on it still does.
                try { e.currentTarget.setPointerCapture(e.pointerId); } catch { /* not capturable */ }
                press.current = { at: e.timeStamp, wasActive: active };
                if (active) return; // its release ends the recording
                toggled.current = false;
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
                handled();
                e.preventDefault();
                if (e.repeat || blocked) return;
                toggle();
            }}
            onKeyUp={e => { if (e.key === ' ' || e.key === 'Enter') handled(); }}
            onClick={e => {
                const pointer = (e.nativeEvent as globalThis.PointerEvent).pointerType;
                if (blocked || pointer === 'touch' || pointer === 'pen' || performance.now() - handledAt.current < ECHO_MS) return;
                toggle();
            }}
            onBlur={() => { if (toggled.current && active) onRelease(); }}
            className={`flex min-h-16 w-full touch-none select-none items-center justify-center gap-3 rounded-lg px-5 text-lg font-bold transition-colors [-webkit-touch-callout:none] [-webkit-user-select:none] aria-disabled:cursor-not-allowed aria-disabled:opacity-60 ${active
                ? 'bg-accent-text text-surface'
                : PRIMARY_FILL}`}
        >
            {view.button === 'listening'
                ? <span aria-hidden="true" className="size-3 rounded-full bg-surface motion-safe:animate-pulse" />
                : <MicrophoneIcon className="h-6 w-6" aria-hidden="true" />}
            {talk[view.button]}
        </button>
    );
}
