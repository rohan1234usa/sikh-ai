'use client';

import { useEffect, useRef, useState } from 'react';
import { CheckIcon } from '@heroicons/react/24/outline';

/** Any heroicon — they all take just a className */
export type IconComponent = React.ComponentType<{ className?: string }>;

export type MenuOption<T extends string> = {
    id: T;
    label: string;
    /** Drawn before the label — the theme picker's sun / moon / desktop */
    icon?: IconComponent;
    /** BCP-47 tag for labels written in their own language */
    lang?: string;
    /** Extra classes for the label, e.g. the Gurmukhi font */
    labelClassName?: string;
};

// The Navbar's single-choice picker: an icon button that opens a menu of
// options with a check on the active one. Both the language and the theme
// pickers are this component, so the two look alike and share one set of
// focus, keyboard and dismissal behaviours.
export default function SettingMenu<T extends string>({
    label,
    icon: TriggerIcon,
    value,
    options,
    onSelect,
}: {
    /** Names the control for screen readers, e.g. "Change language" */
    label: string;
    icon: IconComponent;
    value: T;
    options: readonly MenuOption<T>[];
    onSelect: (next: T) => void;
}) {
    const [open, setOpen] = useState(false);
    const rootRef = useRef<HTMLDivElement>(null);
    const triggerRef = useRef<HTMLButtonElement>(null);
    const itemRefs = useRef<(HTMLButtonElement | null)[]>([]);
    const activeIndex = options.findIndex((o) => o.id === value);

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
        if (open) itemRefs.current[activeIndex]?.focus();
    }, [open, activeIndex]);

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
        const next = (current + delta + options.length) % options.length;
        itemRefs.current[next]?.focus();
    };

    const select = (next: T) => {
        setOpen(false);
        triggerRef.current?.focus();
        // Re-picking the active option is a no-op by definition; staying quiet
        // spares the language picker a needless router.refresh().
        if (next !== value) onSelect(next);
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
                aria-label={label}
                className="p-2 rounded-lg text-slate-300 hover:text-kesri transition-colors"
            >
                <TriggerIcon className="w-5 h-5" />
            </button>

            {open && (
                <div
                    role="menu"
                    aria-label={label}
                    onKeyDown={onMenuKeyDown}
                    className="absolute right-0 mt-2 min-w-44 rounded-xl border border-white/10 bg-navy shadow-xl py-1.5 z-50"
                >
                    {options.map(({ id, label: optionLabel, icon: Icon, lang, labelClassName }, i) => {
                        const selected = id === value;
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
                                <span className="flex items-center gap-2.5">
                                    {Icon && <Icon className="w-4 h-4 shrink-0" />}
                                    <span lang={lang} className={labelClassName}>{optionLabel}</span>
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
