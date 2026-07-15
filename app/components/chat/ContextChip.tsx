'use client';

import { BookOpenIcon, XMarkIcon } from '@heroicons/react/24/outline';
import type { ChatContext } from '@/lib/chat/config';

type Props = {
    context: ChatContext;
    onDismiss: () => void;
};

export default function ContextChip({ context, onDismiss }: Props) {
    return (
        <div className="flex items-center gap-2 bg-kesri/10 border border-kesri/40 text-accent-text rounded-full pl-3 pr-1.5 py-1.5 text-xs max-w-full">
            <BookOpenIcon className="w-4 h-4 shrink-0" aria-hidden="true" />
            <span className="truncate">Discussing: {context.title}</span>
            <button
                type="button"
                onClick={onDismiss}
                aria-label="Stop discussing this passage"
                className="p-0.5 rounded-full hover:bg-kesri/20 transition-colors shrink-0"
            >
                <XMarkIcon className="w-4 h-4" />
            </button>
        </div>
    );
}
