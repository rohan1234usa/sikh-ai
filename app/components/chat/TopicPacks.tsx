'use client';

import { useState } from 'react';
import { TOPIC_PACK_IDS, type TopicPackId } from '@/lib/chat/config';
import { useT } from '../../context/LanguageContext';

type Props = {
    onSelect: (prompt: string) => void;
};

export default function TopicPacks({ onSelect }: Props) {
    const t = useT();
    const [openId, setOpenId] = useState<TopicPackId | null>(null);
    const packs = t.chat.config.topicPacks;
    const openPack = openId ? packs[openId] : null;

    return (
        <div className="pt-6 space-y-3">
            <p className="text-center text-[11px] uppercase tracking-widest text-ink-faint font-bold">{t.chat.browseByTopic}</p>
            <div className="flex flex-wrap gap-2 justify-center">
                {TOPIC_PACK_IDS.map((id) => {
                    const isOpen = id === openId;
                    return (
                        <button
                            key={id}
                            type="button"
                            aria-expanded={isOpen}
                            aria-controls={`topic-pack-panel-${id}`}
                            onClick={() => setOpenId(isOpen ? null : id)}
                            className={`text-sm px-3.5 py-1.5 rounded-full border transition-colors ${
                                isOpen
                                    ? 'border-navy bg-navy text-white dark:border-kesri dark:bg-kesri dark:text-navy font-semibold'
                                    : 'border-edge bg-surface-raised text-ink-muted hover:text-ink hover:border-kesri/50'
                            }`}
                        >
                            {packs[id].label}
                        </button>
                    );
                })}
            </div>
            {openPack && (
                <div id={`topic-pack-panel-${openId}`} className="flex flex-wrap gap-2 justify-center">
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
