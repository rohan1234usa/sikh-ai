// Moving this browser's chats into the signed-in account, one chat at a
// time: each is written to the account and waited for, and only then
// removed from the browser. Safe to run again after it stops part-way: a chat
// already in the account is simply written over with the same content.

import { storeErrorCode, type ChatStore, type StoreErrorCode } from './types';

export type MoveResult = { moved: number; skipped: number; failed?: StoreErrorCode };

export async function moveChats(
    ids: string[],
    from: ChatStore,
    to: ChatStore,
    opts: {
        // A chat with a reply still arriving stays where the reply will save.
        isBusy: (chatId: string) => boolean;
        onProgress?: (moved: number) => void;
    },
): Promise<MoveResult> {
    let moved = 0;
    let skipped = 0;
    for (const id of ids) {
        const state = from.getChat(id);
        if (opts.isBusy(id) || state.status !== 'ready') {
            skipped++;
            continue;
        }
        try {
            await to.importChat(state.record);
            // A question asked while the copy was on its way went to this
            // browser's copy: deleting it now would lose that. Leave the chat
            // here for now; the next move takes it whole.
            if (opts.isBusy(id) || from.getChat(id) !== state) {
                skipped++;
                continue;
            }
            await from.deleteChat(id);
        } catch (e) {
            // Stop at the first refusal: the rest would be refused too.
            return { moved, skipped, failed: storeErrorCode(e) };
        }
        moved++;
        opts.onProgress?.(moved);
    }
    return { moved, skipped };
}
