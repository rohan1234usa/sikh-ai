// Builders for chat transcripts in tests.

import type { Exchange, Notice, Reply, ReplySettings } from '@/lib/chat/transcript';

export const SIKHAI: ReplySettings = { lensId: 'sikhai', modeId: 'balanced', languageId: 'english' };
export const NANAK: ReplySettings = { lensId: 'guru-nanak', modeId: 'balanced', languageId: 'english' };

export function reply(over: Partial<Reply> = {}): Reply {
    return { id: 'r1', status: 'done', text: 'An answer.', settings: SIKHAI, startedAt: 1_000, finishedAt: 2_000, ...over };
}

let seq = 0;
export function exchange(question: string, over: Partial<Omit<Exchange, 'kind' | 'reply'>> & { reply?: Partial<Reply> } = {}): Exchange {
    seq += 1;
    const id = over.id ?? `ex-${seq}`;
    const order = over.order ?? seq * 10;
    return {
        kind: 'exchange',
        id,
        order,
        question: over.question ?? { text: question, createdAt: order },
        reply: reply({ id: `${id}-r`, startedAt: order, ...over.reply }),
    };
}

export function notice(lensId: Notice['lensId'], order: number, id = `n-${order}`): Notice {
    return { kind: 'notice', id, order, createdAt: order, lensId };
}

// A counter-backed id source, so plans are deterministic.
export function ids(prefix = 'id'): () => string {
    let n = 0;
    return () => `${prefix}-${++n}`;
}
