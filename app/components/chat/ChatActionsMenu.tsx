'use client';

import { useLayoutEffect, useRef } from 'react';
import { EllipsisHorizontalIcon } from '@heroicons/react/24/outline';
import { useMenuButton } from '../useMenuButton';
import type { IconComponent } from '../SettingMenu';

export type ChatAction = {
    id: string;
    label: string;
    icon: IconComponent;
    danger?: boolean;
    onSelect: () => void;
};

// A chat's "⋯" menu in the list: the Navbar pickers' behaviour
// (useMenuButton) with plain actions instead of choices. The trigger shows on
// hover or focus with a mouse, and always on touch screens and the open chat.
export default function ChatActionsMenu({ label, actions }: { label: string; actions: ChatAction[] }) {
    const panelRef = useRef<HTMLDivElement>(null);
    const { open, rootRef, triggerRef, itemRef, toggle, choose, onRootBlur, onMenuKeyDown } =
        useMenuButton({ itemCount: actions.length, focusOnOpen: 0 });

    // Opens downward, or upward when the list would cut it off at the bottom.
    useLayoutEffect(() => {
        const panel = panelRef.current;
        if (!open || !panel) return;
        const scroller = panel.closest('[data-history-scroll]');
        const limit = scroller ? scroller.getBoundingClientRect().bottom : window.innerHeight;
        if (panel.getBoundingClientRect().bottom > limit) {
            panel.style.top = 'auto';
            panel.style.bottom = '100%';
            panel.style.marginTop = '0';
            panel.style.marginBottom = '0.25rem';
        }
    }, [open]);

    return (
        <div ref={rootRef} className="relative shrink-0" onBlur={onRootBlur}>
            <button
                ref={triggerRef}
                type="button"
                onClick={toggle}
                aria-haspopup="menu"
                aria-expanded={open}
                aria-label={label}
                className="rounded-md p-1.5 text-ink-muted transition-colors hover:bg-edge/60 hover:text-ink pointer-fine:opacity-0 pointer-fine:group-hover:opacity-100 pointer-fine:group-focus-within:opacity-100 pointer-fine:group-has-[[aria-current=page]]:opacity-100 aria-expanded:opacity-100"
            >
                <EllipsisHorizontalIcon className="h-4 w-4" />
            </button>
            {open && (
                <div
                    ref={panelRef}
                    role="menu"
                    aria-label={label}
                    onKeyDown={onMenuKeyDown}
                    className="absolute right-0 top-full z-20 mt-1 w-44 rounded-xl border border-edge bg-surface-raised py-1.5 shadow-xl dark:shadow-black/40"
                >
                    {actions.map(({ id, label: actionLabel, icon: Icon, danger, onSelect }, i) => (
                        <button
                            key={id}
                            ref={itemRef(i)}
                            type="button"
                            role="menuitem"
                            onClick={() => choose(onSelect)}
                            className={`flex w-full items-center gap-2.5 px-3.5 py-2 text-left text-sm transition-colors hover:bg-edge/60 ${
                                danger ? 'text-red-600 dark:text-red-400' : 'text-ink'
                            }`}
                        >
                            <Icon className="h-4 w-4 shrink-0" />
                            {actionLabel}
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
}
