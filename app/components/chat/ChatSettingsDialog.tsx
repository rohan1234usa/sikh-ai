'use client';

import { useEffect, useRef } from 'react';
import { XMarkIcon } from '@heroicons/react/24/outline';
import {
    LANGUAGES,
    LANGUAGE_IDS,
    MODES,
    MODE_IDS,
    type LanguageId,
    type LensId,
    type ModeId,
} from '@/lib/chat/config';
import LensPicker from './LensPicker';
import type { ChatPrefs } from './useChatPrefs';

type Props = {
    open: boolean;
    prefs: ChatPrefs;
    onSelectLens: (id: LensId) => void;
    onSelectMode: (id: ModeId) => void;
    onSelectLanguage: (id: LanguageId) => void;
    onClose: () => void;
};

function Pill({ selected, onClick, children }: { selected: boolean; onClick: () => void; children: React.ReactNode }) {
    return (
        <button
            type="button"
            aria-pressed={selected}
            onClick={onClick}
            className={`px-3.5 py-1.5 rounded-full text-sm border transition-colors ${
                selected
                    ? 'border-kesri bg-kesri/10 text-accent-text font-semibold'
                    : 'border-edge bg-surface-raised text-ink-muted hover:text-ink hover:border-kesri/50'
            }`}
        >
            {children}
        </button>
    );
}

export default function ChatSettingsDialog({ open, prefs, onSelectLens, onSelectMode, onSelectLanguage, onClose }: Props) {
    const panelRef = useRef<HTMLDivElement>(null);
    const triggerRef = useRef<Element | null>(null);

    // Focus the panel on open; restore focus to the element that opened it on
    // close. Keyed only on `open` so pref-change re-renders don't steal focus
    // back off the pill the user just activated.
    useEffect(() => {
        if (!open) return;
        triggerRef.current = document.activeElement;
        panelRef.current?.focus();
        return () => {
            if (triggerRef.current instanceof HTMLElement) triggerRef.current.focus();
        };
    }, [open]);

    // Escape closes; Tab is trapped within the modal so focus can't wander into
    // the (non-inert) background the aria-modal overlay covers.
    useEffect(() => {
        if (!open) return;
        const onKey = (e: KeyboardEvent) => {
            if (e.key === 'Escape') { onClose(); return; }
            if (e.key !== 'Tab') return;
            const panel = panelRef.current;
            if (!panel) return;
            const focusables = Array.from(
                panel.querySelectorAll<HTMLElement>('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])')
            ).filter((el) => !el.hasAttribute('disabled') && el.offsetParent !== null);
            if (focusables.length === 0) return;
            const first = focusables[0];
            const last = focusables[focusables.length - 1];
            const active = document.activeElement;
            if (e.shiftKey && active === first) {
                e.preventDefault();
                last.focus();
            } else if (!e.shiftKey && active === last) {
                e.preventDefault();
                first.focus();
            } else if (!panel.contains(active)) {
                e.preventDefault();
                first.focus();
            }
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [open, onClose]);

    if (!open) return null;

    return (
        <div className="fixed inset-0 z-50">
            <div className="absolute inset-0 bg-black/40" onClick={onClose} aria-hidden="true" />
            <div
                ref={panelRef}
                tabIndex={-1}
                role="dialog"
                aria-modal="true"
                aria-label="Chat settings"
                className="absolute bottom-0 inset-x-0 max-h-[85dvh] overflow-y-auto rounded-t-2xl bg-surface border-t border-edge shadow-2xl p-4 pb-[max(1rem,env(safe-area-inset-bottom))] focus:outline-none md:bottom-auto md:inset-x-auto md:top-20 md:left-1/2 md:-translate-x-1/2 md:w-full md:max-w-2xl md:max-h-[80dvh] md:rounded-2xl md:border md:p-6"
            >
                <div className="flex items-center justify-between mb-4">
                    <h2 className="text-base font-bold text-ink">Chat settings</h2>
                    <button
                        type="button"
                        onClick={onClose}
                        aria-label="Close settings"
                        className="p-1.5 rounded-lg text-ink-faint hover:text-ink hover:bg-edge/60 transition-colors"
                    >
                        <XMarkIcon className="w-5 h-5" />
                    </button>
                </div>

                <div className="space-y-6">
                    <section>
                        <h3 className="text-xs font-bold uppercase tracking-wider text-ink-faint mb-2">Perspective</h3>
                        <p className="text-xs text-ink-muted mb-3">
                            SikhAI never speaks as a Guru — it answers guided by the chosen Guru&apos;s life, Bani, and teachings.
                        </p>
                        <LensPicker selectedId={prefs.lensId} onSelect={onSelectLens} />
                    </section>

                    <section>
                        <h3 className="text-xs font-bold uppercase tracking-wider text-ink-faint mb-2">Response style</h3>
                        <div role="group" aria-label="Response style" className="flex flex-wrap gap-2">
                            {MODE_IDS.map((id) => (
                                <Pill key={id} selected={id === prefs.modeId} onClick={() => onSelectMode(id)}>
                                    {MODES[id].name}
                                </Pill>
                            ))}
                        </div>
                        <p className="text-xs text-ink-muted mt-2">{MODES[prefs.modeId].description}</p>
                    </section>

                    <section>
                        <h3 className="text-xs font-bold uppercase tracking-wider text-ink-faint mb-2">Language</h3>
                        <div role="group" aria-label="Language" className="flex flex-wrap gap-2">
                            {LANGUAGE_IDS.map((id) => (
                                <Pill key={id} selected={id === prefs.languageId} onClick={() => onSelectLanguage(id)}>
                                    {LANGUAGES[id].name}
                                </Pill>
                            ))}
                        </div>
                        <p className="text-xs text-ink-muted mt-2">{LANGUAGES[prefs.languageId].description}</p>
                    </section>
                </div>

                <div className="flex items-center justify-between mt-6 pt-4 border-t border-edge">
                    <p className="text-xs text-ink-faint">Powered by Gemini</p>
                    <button
                        type="button"
                        onClick={onClose}
                        className="bg-kesri text-navy font-bold text-sm px-5 py-2 rounded-lg hover:opacity-90 transition-opacity"
                    >
                        Done
                    </button>
                </div>
            </div>
        </div>
    );
}
