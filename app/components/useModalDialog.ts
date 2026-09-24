'use client';

import { useEffect, useRef } from 'react';

// A native <dialog> opened as a modal, following `open`. The browser makes the
// page behind it inert, draws it above the sticky navbar, and hands focus back
// to whatever opened it on close. Never set the `open` attribute directly: that
// shows a non-modal dialog.
export function useModalDialog(open: boolean, onClose: () => void) {
    const ref = useRef<HTMLDialogElement>(null);

    useEffect(() => {
        const dialog = ref.current;
        if (!dialog) return;
        if (open && !dialog.open) {
            dialog.showModal();
            dialog.querySelector<HTMLElement>('[data-initial-focus]')?.focus();
        } else if (!open && dialog.open) {
            dialog.close();
        }
    }, [open]);

    return {
        ref,
        // Escape: the state closes it, so React and the element never disagree.
        onCancel: (e: React.SyntheticEvent) => {
            e.preventDefault();
            onClose();
        },
        // The dialog has no padding, so a click on the element itself is the backdrop.
        onClick: (e: React.MouseEvent) => {
            if (e.target === e.currentTarget) onClose();
        },
    };
}
