// Client-safe: what else in the tab must stop before the account's data goes
// (lib/account/deletion.ts). The chat stores register here when account chats
// load (app/components/chat/chatStores.ts), so the dialog that deletes an
// account never imports chat code, and a page that never loaded them has
// nothing to stop.

type Hook = (uid: string) => void;
const hooks = new Set<Hook>();

export function onAccountDeletion(hook: Hook): () => void {
    hooks.add(hook);
    return () => { hooks.delete(hook); };
}

export function prepareAccountDeletion(uid: string): void {
    for (const hook of [...hooks]) hook(uid);
}
