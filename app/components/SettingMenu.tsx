'use client';

import { CheckIcon } from '@heroicons/react/24/outline';
import { useMenuButton } from './useMenuButton';

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

// The Navbar's single-choice picker: an icon button that opens a menu of
// options with a check on the active one. Both the language and the theme
// pickers are this component, so the two look alike. The focus, keyboard and
// dismissal behaviour is useMenuButton, shared with the chat bar's chips.
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
    const active = options.find((o) => o.id === value);
    const activeIndex = options.findIndex((o) => o.id === value);
    const { open, rootRef, triggerRef, itemRef, toggle, choose, onRootBlur, onMenuKeyDown } =
        useMenuButton({ itemCount: options.length, focusOnOpen: activeIndex });

    const select = (next: T) => {
        // Always reported, even when it matches what this menu shows. `value`
        // reflects THIS tab's DOM, which can disagree with what was persisted
        // (another tab wrote it, or a write was blocked), and swallowing the
        // re-pick would leave the user no way to reassert their choice. A
        // caller for which re-selection is genuinely costly guards its own.
        choose(() => onSelect(next));
    };

    return (
        <div
            ref={rootRef}
            className="relative"
            onBlur={onRootBlur}
        >
            <button
                ref={triggerRef}
                type="button"
                onClick={toggle}
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
                                ref={itemRef(i)}
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
