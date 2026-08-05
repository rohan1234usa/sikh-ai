'use client';

import { MicrophoneIcon, StopIcon } from '@heroicons/react/24/solid';
import { useT } from '../../context/LanguageContext';
import { fmt } from '@/lib/i18n/fmt';
import { MAX_RECORD_MS } from '@/lib/identify/config';
import type { RecorderStatus } from './useIdentifyRecorder';

type Props = {
    status: RecorderStatus;
    elapsedMs: number;
    level: number;   // 0..1 live input level
    disabled: boolean;
    onPress: () => void;
    onCancel: () => void;
};

const MAX_SECONDS = Math.round(MAX_RECORD_MS / 1000);

// Presentational: every decision about what to do with the audio lives in the
// page. The ring scales with the live input level so the user can see the
// microphone is actually picking the kirtan up — the one piece of feedback that
// tells them to move closer before wasting a whole clip.
export default function RecordButton({ status, elapsedMs, level, disabled, onPress, onCancel }: Props) {
    const t = useT();
    const recording = status === 'recording';
    const seconds = Math.min(MAX_SECONDS, Math.floor(elapsedMs / 1000));
    // Clamped so a loud room can't inflate the ring past the layout.
    const ringScale = 1 + Math.min(level, 1) * 0.35;

    return (
        <div className="flex flex-col items-center gap-3">
            <div className="relative flex items-center justify-center w-28 h-28">
                {recording && (
                    <>
                        <span
                            aria-hidden="true"
                            className="absolute inset-0 rounded-full bg-kesri/30 motion-safe:animate-pulse-ring"
                        />
                        <span
                            aria-hidden="true"
                            className="absolute inset-2 rounded-full bg-kesri/20 transition-transform duration-100"
                            style={{ transform: `scale(${ringScale})` }}
                        />
                    </>
                )}
                <button
                    type="button"
                    onClick={onPress}
                    disabled={disabled || status === 'requesting'}
                    aria-label={recording ? t.identify.stopAria : t.identify.recordAria}
                    className={`relative z-10 flex items-center justify-center w-20 h-20 rounded-full shadow-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
                        recording
                            ? 'bg-white text-navy'
                            : 'bg-kesri text-navy hover:bg-kesri-hover'
                    }`}
                >
                    {recording
                        ? <StopIcon className="w-8 h-8" aria-hidden="true" />
                        : <MicrophoneIcon className="w-9 h-9" aria-hidden="true" />}
                </button>
            </div>

            {recording ? (
                <>
                    {/* The counter updates ten times a second; announcing every
                        tick would flood a screen reader, and the button's own
                        label already says what stopping does. */}
                    <p aria-hidden="true" className="text-sm font-semibold text-white tabular-nums">
                        {fmt(t.identify.elapsed, { n: seconds, max: MAX_SECONDS })}
                    </p>
                    <p className="text-xs text-slate-300">{t.identify.listening}</p>
                    <button
                        type="button"
                        onClick={onCancel}
                        aria-label={t.identify.cancelAria}
                        className="text-xs text-slate-300 hover:text-white underline underline-offset-2"
                    >
                        {t.identify.cancel}
                    </button>
                </>
            ) : (
                <>
                    <p className="text-sm font-semibold text-white">{t.identify.tapToIdentify}</p>
                    <p className="text-xs text-slate-300 text-center max-w-xs">
                        {fmt(t.identify.autoStopNote, { n: MAX_SECONDS })}
                    </p>
                </>
            )}
        </div>
    );
}
