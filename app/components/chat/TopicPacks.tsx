'use client';

import { useState } from 'react';
import { TOPIC_PACKS } from '@/lib/chat/config';

type Props = {
    onSelect: (prompt: string) => void;
};

export default function TopicPacks({ onSelect }: Props) {
    const [openId, setOpenId] = useState<string | null>(null);
    const openPack = TOPIC_PACKS.find((p) => p.id === openId);

    return (
        <div className="pt-6 space-y-3">
            <p className="text-center text-[11px] uppercase tracking-widest text-ink-faint font-bold">Browse by topic</p>
            <div className="flex flex-wrap gap-2 justify-center">
                {TOPIC_PACKS.map((pack) => {
                    const isOpen = pack.id === openId;
                    return (
                        <button
                            key={pack.id}
                            type="button"
                            aria-expanded={isOpen}
                            aria-controls={`topic-pack-panel-${pack.id}`}
                            onClick={() => setOpenId(isOpen ? null : pack.id)}
                            className={`text-sm px-3.5 py-1.5 rounded-full border transition-colors ${
                                isOpen
                                    ? 'border-navy bg-navy text-white dark:border-kesri dark:bg-kesri dark:text-navy font-semibold'
                                    : 'border-edge bg-surface-raised text-ink-muted hover:text-ink hover:border-kesri/50'
                            }`}
                        >
                            {pack.label}
                        </button>
                    );
                })}
            </div>
            {openPack && (
                <div id={`topic-pack-panel-${openPack.id}`} className="flex flex-wrap gap-2 justify-center">
                    {openPack.prompts.map((prompt) => (
                        <button
                            key={prompt}
                            type="button"
                            onClick={() => onSelect(prompt)}
                            className="border border-kesri/50 text-accent-text text-sm px-4 py-2 rounded-full hover:bg-kesri/10 transition-colors"
                        >
                            {prompt}
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
}
