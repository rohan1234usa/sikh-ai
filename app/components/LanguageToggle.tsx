'use client';

import { useEffect, useRef, useState } from 'react';
import { CheckIcon, LanguageIcon } from '@heroicons/react/24/outline';
import { LANGS, LANG_META, type Lang } from '@/lib/i18n/config';
import { useLanguage } from '../context/LanguageContext';

// Site-language picker, mounted in the Navbar next to ThemeToggle. Option
// labels are intentionally NOT translated — each language names itself.
export default function LanguageToggle() {
    const { lang, setLang, t } = useLanguage();
    const [open, setOpen] = useState(false);
    const rootRef = useRef<HTMLDivElement>(null);
    const triggerRef = useRef<HTMLButtonElement>(null);
    const itemRefs = useRef<(HTMLButtonElement | null)[]>([]);

    // Close on outside pointerdown
    useEffect(() => {
        if (!open) return;
        const onPointerDown = (e: PointerEvent) => {
            if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
        };
        document.addEventListener('pointerdown', onPointerDown);
        return () => document.removeEventListener('pointerdown', onPointerDown);
    }, [open]);

    // Focus the active option when the menu opens
    useEffect(() => {
        if (open) itemRefs.current[LANGS.indexOf(lang)]?.focus();
    }, [open, lang]);

    const onMenuKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Escape') {
            setOpen(false);
            triggerRef.current?.focus();
            return;
        }
        if (e.key === 'Tab') {
            // Move focus to the trigger (which stays mounted) BEFORE closing, so
            // the menu item unmounting can't drop focus to the top of the page;
            // native Tab/Shift+Tab then advances from the trigger normally.
            triggerRef.current?.focus();
            setOpen(false);
            return;
        }
        if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return;
        e.preventDefault();
        const current = itemRefs.current.findIndex((el) => el === document.activeElement);
        const delta = e.key === 'ArrowDown' ? 1 : -1;
        const next = (current + delta + LANGS.length) % LANGS.length;
        itemRefs.current[next]?.focus();
    };

    const select = (next: Lang) => {
        setOpen(false);
        triggerRef.current?.focus();
        if (next !== lang) setLang(next);
    };

    return (
        <div
            ref={rootRef}
            className="relative"
            onBlur={(e) => {
                // Close when focus leaves the widget entirely (complements the
                // outside-pointerdown listener for keyboard users)
                if (!rootRef.current?.contains(e.relatedTarget as Node)) setOpen(false);
            }}
        >
            <button
                ref={triggerRef}
                type="button"
                onClick={() => setOpen((o) => !o)}
                aria-haspopup="menu"
                aria-expanded={open}
                aria-label={t.nav.changeLanguage}
                className="p-2 rounded-lg text-slate-300 hover:text-kesri transition-colors"
            >
                <LanguageIcon className="w-5 h-5" />
            </button>

            {open && (
                <div
                    role="menu"
                    aria-label={t.nav.changeLanguage}
                    onKeyDown={onMenuKeyDown}
                    className="absolute right-0 mt-2 min-w-44 rounded-xl border border-white/10 bg-navy shadow-xl py-1.5 z-50"
                >
                    {LANGS.map((id, i) => {
                        const selected = id === lang;
                        return (
                            <button
                                key={id}
                                ref={(el) => { itemRefs.current[i] = el; }}
                                type="button"
                                role="menuitemradio"
                                aria-checked={selected}
                                onClick={() => select(id)}
                                className={`flex w-full items-center justify-between gap-3 px-3.5 py-2 text-sm text-left transition-colors ${
                                    selected ? 'text-kesri font-semibold' : 'text-slate-200 hover:text-kesri hover:bg-white/5'
                                }`}
                            >
                                <span lang={LANG_META[id].htmlLang} className={id === 'pa' ? 'font-gurmukhi' : undefined}>
                                    {LANG_META[id].label}
                                </span>
                                {selected && <CheckIcon className="w-4 h-4 shrink-0" aria-hidden="true" />}
                            </button>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
