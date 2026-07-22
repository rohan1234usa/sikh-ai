'use client';

import { useState } from 'react';
import { ClipboardIcon, CheckIcon } from '@heroicons/react/24/outline';
import { useT } from '../../context/LanguageContext';

type Props = {
    text: string;      // what gets copied
    ariaLabel: string; // full label, e.g. fmt(t.translate.copyAria, { label })
};

// Clipboard button with the transient "copied" state (icon + aria-label swap,
// 1.5s reset) — same pattern as the chat message copy action.
export default function CopyButton({ text, ariaLabel }: Props) {
    const t = useT();
    const [copied, setCopied] = useState(false);

    const copy = async () => {
        try {
            await navigator.clipboard.writeText(text);
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
        } catch { /* clipboard unavailable */ }
    };

    return (
        <button
            type="button"
            onClick={copy}
            aria-label={copied ? t.translate.copiedAria : ariaLabel}
            className="p-1.5 rounded-lg text-ink-faint hover:text-ink hover:bg-edge/60 transition-colors"
        >
            {copied ? <CheckIcon className="w-4 h-4" /> : <ClipboardIcon className="w-4 h-4" />}
        </button>
    );
}
