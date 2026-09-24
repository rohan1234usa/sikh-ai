'use client';

import { useId, useLayoutEffect, useRef } from 'react';
import { CheckIcon, ChevronDownIcon } from '@heroicons/react/24/outline';
import { useMenuButton } from '../useMenuButton';
import type { IconComponent } from '../SettingMenu';

export type ChipOption<T extends string> = {
    id: T;
    label: string;
    /** Small capitals after the label, e.g. a Guru's ordinal ("First Guru") */
    badge?: string;
    description?: string;
};

type Props<T extends string> = {
    /** The menu's heading; the chip is named "{heading} ({text})" */
    heading: string;
    /** A line under the heading, e.g. the perspective note */
    note?: string;
    icon?: IconComponent;
    value: T;
    /** The chip's text when it isn't the active option's label (Auto shows the language it means) */
    text?: string;
    options: readonly ChipOption<T>[];
    onSelect: (next: T) => void;
};

// Room kept between the menu and the viewport edge, or the top of the chat.
const MARGIN = 8;
// Below this the menu may cover the header rather than become unusable.
const MIN_MENU_HEIGHT = 160;

// One answer setting in the chat bar: a chip showing the current choice that
// opens a menu of the others upward, each with what it does. The behaviour is
// the Navbar pickers' (useMenuButton). The heading and note sit outside
// role="menu", which may only hold items, and the panel around them takes
// focus, so a press on the text or the scrollbar keeps the menu open.
export default function ChatSettingChip<T extends string>({ heading, note, icon: Icon, value, text, options, onSelect }: Props<T>) {
    const id = useId();
    const panelRef = useRef<HTMLDivElement>(null);
    const activeIndex = Math.max(0, options.findIndex((o) => o.id === value));
    const { open, rootRef, triggerRef, itemRef, toggle, choose, onRootBlur, onMenuKeyDown } =
        useMenuButton({ itemCount: options.length, focusOnOpen: activeIndex });
    const chipText = text ?? options[activeIndex]?.label ?? '';

    // Opens upward from the chip. Shift left when a chip near the right edge
    // (or wrapped to a second row on a phone) would push it off screen, and cap
    // its height at the room between the chip and the top of the chat. A layout
    // effect, so it runs before the hook focuses the active option: that focus
    // then scrolls the option into view inside the capped list.
    useLayoutEffect(() => {
        const panel = panelRef.current;
        const trigger = triggerRef.current;
        if (!open || !panel || !trigger) return;
        const fit = () => {
            panel.style.translate = '';
            const { left, right } = panel.getBoundingClientRect();
            const over = right - (document.documentElement.clientWidth - MARGIN);
            panel.style.translate = over > 0 ? `${-Math.min(over, left - MARGIN)}px 0` : '';
            const top = panel.closest('main')?.getBoundingClientRect().top ?? 0;
            const room = trigger.getBoundingClientRect().top - top - 2 * MARGIN;
            panel.style.maxHeight = `${Math.max(MIN_MENU_HEIGHT, room)}px`;
        };
        fit();
        window.addEventListener('resize', fit);
        return () => window.removeEventListener('resize', fit);
    }, [open, triggerRef]);

    return (
        <div ref={rootRef} className="relative min-w-0 max-w-full" onBlur={onRootBlur}>
            <button
                ref={triggerRef}
                type="button"
                onClick={toggle}
                aria-haspopup="menu"
                aria-expanded={open}
                aria-label={`${heading} (${chipText})`}
                className="flex h-8 max-w-full items-center gap-1 rounded-full border border-edge bg-surface pl-2.5 pr-2 text-xs sm:text-sm font-medium text-ink-muted transition-colors hover:border-kesri/50 hover:text-ink aria-expanded:border-kesri aria-expanded:text-ink"
            >
                {Icon && <Icon className="h-3.5 w-3.5 shrink-0 text-accent-text" />}
                <span className="truncate">{chipText}</span>
                <ChevronDownIcon className="h-3 w-3 shrink-0" aria-hidden="true" />
            </button>

            {open && (
                <div
                    ref={panelRef}
                    tabIndex={-1}
                    onKeyDown={onMenuKeyDown}
                    className="absolute bottom-full left-0 z-50 mb-2 flex w-[min(20rem,calc(100vw-1rem))] flex-col rounded-xl border border-edge bg-surface-raised shadow-xl focus:outline-none dark:shadow-black/40"
                >
                    <div className="shrink-0 border-b border-edge px-3.5 pt-3 pb-2">
                        <p id={`${id}-heading`} className="text-[11px] font-bold uppercase tracking-wider text-ink-muted">{heading}</p>
                        {note && <p id={`${id}-note`} className="mt-1 text-xs text-ink-muted">{note}</p>}
                    </div>
                    <div
                        role="menu"
                        aria-labelledby={`${id}-heading`}
                        aria-describedby={note ? `${id}-note` : undefined}
                        className="min-h-0 overflow-y-auto overscroll-contain py-1.5"
                    >
                        {options.map((option, i) => {
                            const selected = option.id === value;
                            return (
                                <button
                                    key={option.id}
                                    ref={itemRef(i)}
                                    type="button"
                                    role="menuitemradio"
                                    aria-checked={selected}
                                    aria-labelledby={`${id}-${i}`}
                                    aria-describedby={option.description ? `${id}-${i}-description` : undefined}
                                    onClick={() => choose(() => onSelect(option.id))}
                                    className={`flex w-full items-start gap-3 px-3.5 py-2 text-left transition-colors ${
                                        selected ? 'bg-kesri/10' : 'hover:bg-edge/60'
                                    }`}
                                >
                                    <span className="min-w-0 flex-1">
                                        <span
                                            id={`${id}-${i}`}
                                            className={`block text-sm ${selected ? 'font-semibold text-accent-text' : 'font-medium text-ink'}`}
                                        >
                                            {option.label}
                                            {option.badge && (
                                                <span className="ms-2 whitespace-nowrap text-[10px] font-bold uppercase tracking-wider text-accent-text">
                                                    {option.badge}
                                                </span>
                                            )}
                                        </span>
                                        {option.description && (
                                            <span id={`${id}-${i}-description`} className="mt-0.5 block text-xs text-ink-muted">
                                                {option.description}
                                            </span>
                                        )}
                                    </span>
                                    {selected && <CheckIcon className="mt-0.5 h-4 w-4 shrink-0 text-accent-text" aria-hidden="true" />}
                                </button>
                            );
                        })}
                    </div>
                </div>
            )}
        </div>
    );
}
