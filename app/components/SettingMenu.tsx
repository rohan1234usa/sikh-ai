'use client';

import { useEffect, useRef, useState } from 'react';
import { CheckIcon } from '@heroicons/react/24/outline';

/** Any icon component that takes just a className (heroicons, ThemeIcon) */
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

// A press on one of these owns where focus goes; see the dismissal effect.
const INTERACTIVE = 'a[href], button, input, select, textarea, summary, [tabindex], [contenteditable]';

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
    name,
}: {
    /** Names the control for screen readers, e.g. "Change language" */
    label: string;
    icon: IconComponent;
    value: T;
    options: readonly MenuOption<T>[];
    onSelect: (next: T) => void;
    /**
     * The trigger's accessible name as content instead of an aria-label, for a
     * caller that has to choose it in CSS before hydration (see ThemeToggle).
     */
    name?: React.ReactNode;
}) {
    const [open, setOpen] = useState(false);
    const rootRef = useRef<HTMLDivElement>(null);
    const triggerRef = useRef<HTMLButtonElement>(null);
    const itemRefs = useRef<(HTMLButtonElement | null)[]>([]);
    const wasOpen = useRef(false);
    // True from a press on the trigger until the click it produces; see onBlur.
    const pressingTrigger = useRef(false);
    const active = options.find((o) => o.id === value);
    const activeIndex = options.findIndex((o) => o.id === value);

    // Close when a pointer goes down outside the widget. (Focus leaving is the
    // root's onBlur.) Runs before the press moves focus, so it can also mark a
    // press on the trigger for onBlur.
    useEffect(() => {
        if (!open) return;
        const onPointerDown = (e: PointerEvent) => {
            const target = e.target as Element;
            pressingTrigger.current = !!triggerRef.current?.contains(target);
            if (!rootRef.current || rootRef.current.contains(target)) return;
            const hadFocus = rootRef.current.contains(document.activeElement);
            setOpen(false);
            // The menu item holding focus just unmounted, and on plain page
            // content the browser drops focus on <body>, so the next Tab would
            // restart from the top. Re-home it on the trigger once the browser
            // has settled — unless the press was on a control, which owns focus
            // (Safari and Firefox on macOS leave <body> focused after a button
            // click, and re-homing would pull focus away from what was clicked).
            if (hadFocus && !target.closest?.(INTERACTIVE)) setTimeout(() => {
                if (document.activeElement === document.body) triggerRef.current?.focus();
            });
        };
        document.addEventListener('pointerdown', onPointerDown);
        return () => document.removeEventListener('pointerdown', onPointerDown);
    }, [open]);

    // Focus the active option, but only on the closed -> open transition: if
    // `value` changes while the menu is open, re-focusing would yank focus off
    // whatever the user had arrowed to.
    useEffect(() => {
        if (open && !wasOpen.current) itemRefs.current[activeIndex]?.focus();
        wasOpen.current = open;
    }, [open, activeIndex]);

    const onMenuKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Escape') {
            setOpen(false);
            triggerRef.current?.focus();
            return;
        }
        if (e.key === 'Tab') {
            // Move focus to the trigger (which stays mounted) BEFORE closing, so
            // the menu item unmounting can't drop focus to the top of the page.
            // Tab then carries on natively from the trigger to what follows it.
            // Shift+Tab must stop ON the trigger — it's the element just before
            // the menu — so cancel the native move, which would skip past it.
            triggerRef.current?.focus();
            setOpen(false);
            if (e.shiftKey) e.preventDefault();
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
        // Always reported, even when it matches what this menu shows. `value`
        // reflects THIS tab's DOM, which can disagree with what was persisted
        // (another tab wrote it, or a write was blocked), and swallowing the
        // re-pick would leave the user no way to reassert their choice. A
        // caller for which re-selection is genuinely costly guards its own.
        onSelect(next);
    };

    return (
        <div
            ref={rootRef}
            className="relative"
            onBlur={(e) => {
                // Close when focus leaves the widget: to another element, to
                // <body>, into an iframe, or with the window.
                if (rootRef.current?.contains(e.relatedTarget as Node)) return;
                // Except mid-press on the trigger. Safari and Firefox on macOS
                // don't focus a <button> on click, so that press blurs the open
                // menu with no relatedTarget before the click lands; closing
                // here would let the click re-open it. The click closes it.
                if (pressingTrigger.current) return;
                setOpen(false);
            }}
        >
            <button
                ref={triggerRef}
                type="button"
                onClick={() => { pressingTrigger.current = false; setOpen((o) => !o); }}
                aria-haspopup="menu"
                aria-expanded={open}
                // The icon carries the current value for sighted users, but
                // heroicons render aria-hidden, so name the value here too —
                // otherwise every state announces identically.
                aria-label={name ? undefined : active ? `${label} (${active.label})` : label}
                className="p-2 rounded-lg text-slate-300 hover:text-kesri transition-colors"
            >
                <TriggerIcon className="w-5 h-5" />
                {name && <span className="sr-only">{name}</span>}
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
