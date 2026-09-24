'use client';

import { useEffect, useRef, useState } from 'react';

// A press on one of these owns where focus goes; see the dismissal effect.
const INTERACTIVE = 'a[href], button, input, select, textarea, summary, [tabindex], [contenteditable]';

// The behaviour of a button that opens a menu: how it opens, where focus goes,
// the keys it answers to, and every way it closes. The Navbar's pickers
// (SettingMenu), the chat bar's chips and the chat list's row menus all use
// it, so they share one tuned set of focus and dismissal rules and differ
// only in their markup.
//
// Wire-up: rootRef + onBlur={onRootBlur} on a wrapper around the trigger and
// the menu; triggerRef + onClick={toggle} on the trigger; onKeyDown=
// {onMenuKeyDown} on the menu; ref={itemRef(i)} on each item, which runs its
// action through choose().
export function useMenuButton({ itemCount, focusOnOpen }: {
    itemCount: number;
    /** The item focused when the menu opens: the active choice, or 0 */
    focusOnOpen: number;
}) {
    const [open, setOpen] = useState(false);
    const rootRef = useRef<HTMLDivElement>(null);
    const triggerRef = useRef<HTMLButtonElement>(null);
    const itemRefs = useRef<(HTMLElement | null)[]>([]);
    const wasOpen = useRef(false);
    // True from a press on the trigger until the click it produces; see onRootBlur.
    const pressingTrigger = useRef(false);

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
    // the active option changes while the menu is open, re-focusing would yank
    // focus off whatever the user had arrowed to.
    useEffect(() => {
        if (open && !wasOpen.current) itemRefs.current[focusOnOpen]?.focus();
        wasOpen.current = open;
    }, [open, focusOnOpen]);

    const focusItem = (index: number) => itemRefs.current[index]?.focus();

    const onMenuKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Escape') {
            // Handled here, so a menu inside a modal <dialog> closes without
            // the Escape also closing the dialog around it.
            e.preventDefault();
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
        if (itemCount === 0) return;
        if (e.key === 'Home' || e.key === 'End') {
            e.preventDefault();
            focusItem(e.key === 'Home' ? 0 : itemCount - 1);
            return;
        }
        if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return;
        e.preventDefault();
        const current = itemRefs.current.findIndex((el) => el === document.activeElement);
        const delta = e.key === 'ArrowDown' ? 1 : -1;
        // Nothing focused yet (a press on a menu's heading focuses the panel
        // itself): Down starts at the top, Up at the bottom.
        const next = current === -1
            ? (delta > 0 ? 0 : itemCount - 1)
            : (current + delta + itemCount) % itemCount;
        focusItem(next);
    };

    return {
        open,
        rootRef,
        triggerRef,
        itemRef: (index: number) => (el: HTMLElement | null) => { itemRefs.current[index] = el; },
        toggle: () => { pressingTrigger.current = false; setOpen((o) => !o); },
        /** Close, hand focus back to the trigger, then run the item's action */
        choose: (run: () => void) => {
            setOpen(false);
            triggerRef.current?.focus();
            run();
        },
        onRootBlur: (e: React.FocusEvent) => {
            // Close when focus leaves the widget: to another element, to
            // <body>, into an iframe, or with the window.
            if (rootRef.current?.contains(e.relatedTarget as Node)) return;
            // Except mid-press on the trigger. Safari and Firefox on macOS
            // don't focus a <button> on click, so that press blurs the open
            // menu with no relatedTarget before the click lands; closing
            // here would let the click re-open it. The click closes it.
            if (pressingTrigger.current) return;
            setOpen(false);
        },
        onMenuKeyDown,
    };
}
