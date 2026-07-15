'use client';

import { LENSES, LENS_IDS, type LensId } from '@/lib/chat/config';

type Props = {
    selectedId: LensId;
    onSelect: (id: LensId) => void;
};

export default function LensPicker({ selectedId, onSelect }: Props) {
    return (
        <div role="group" aria-label="Guru perspective" className="grid grid-cols-2 md:grid-cols-3 gap-2">
            {LENS_IDS.map((id) => {
                const lens = LENSES[id];
                const selected = id === selectedId;
                return (
                    <button
                        key={id}
                        type="button"
                        aria-pressed={selected}
                        onClick={() => onSelect(id)}
                        className={`text-left rounded-xl border p-3 transition-colors ${
                            selected
                                ? 'border-kesri ring-2 ring-kesri bg-kesri/10'
                                : 'border-edge bg-surface-raised hover:border-kesri/50'
                        }`}
                    >
                        <span className="block text-sm font-semibold text-ink">{lens.name}</span>
                        {lens.ordinal && (
                            <span className="block text-[11px] uppercase tracking-wider text-accent-text font-bold mt-0.5">
                                {lens.ordinal}
                            </span>
                        )}
                        <span className="block text-xs text-ink-muted mt-1 line-clamp-2">{lens.tagline}</span>
                    </button>
                );
            })}
        </div>
    );
}
