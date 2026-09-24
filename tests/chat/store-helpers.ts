// A localStorage stand-in with a size limit, and small helpers for store tests.

import type { ChatMeta } from '@/lib/chat/chatMeta';
import type { StorageLike } from '@/lib/chat/store/local';

export class FakeStorage implements StorageLike {
    readonly map = new Map<string, string>();
    constructor(public quota = Infinity) {}

    get length() {
        return this.map.size;
    }
    key(i: number) {
        return [...this.map.keys()][i] ?? null;
    }
    getItem(k: string) {
        return this.map.get(k) ?? null;
    }
    setItem(k: string, v: string) {
        let size = k.length + v.length;
        for (const [key, value] of this.map) if (key !== k) size += key.length + value.length;
        if (size > this.quota) throw new DOMException('The quota has been exceeded.', 'QuotaExceededError');
        this.map.set(k, v);
    }
    removeItem(k: string) {
        this.map.delete(k);
    }
    size() {
        let n = 0;
        for (const [k, v] of this.map) n += k.length + v.length;
        return n;
    }
}

export const UUID = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;

export function meta(n: number, over: Partial<ChatMeta> = {}): ChatMeta {
    return { id: UUID(n), title: `Chat ${n}`, titleSource: 'auto', createdAt: n, updatedAt: n, pinned: false, share: null, ...over };
}

// Lets pending promise callbacks and stream reads run.
export async function settle(rounds = 20) {
    for (let i = 0; i < rounds; i++) await new Promise((r) => setImmediate(r));
}
